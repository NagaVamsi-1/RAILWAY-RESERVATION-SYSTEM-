const express = require("express");
const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const SeatAvailability = require("../models/SeatAvailability");
const { validatePaymentDetails, processPayment } = require("../services/payment");
const { generatePnr, isValidPnrFormat } = require("../services/pnr");
const { calculateRefund, generateRefundId } = require("../services/refund");
const {
  keyOf,
  promoteWaitlist,
  syncWaitlistedBooking,
} = require("../services/waitlist");
const { releaseExpiredHolds } = require("../services/holds");
const { toPublicBooking } = require("../services/publicBooking");
const authenticateToken = require("../middleware/auth");

const router = express.Router();


const DUPLICATE_KEY = 11000;

// BL-13 / BL-14: confirmed tickets and waitlisted tickets can be cancelled.
const CANCELLABLE_STATUSES = ["CONFIRMED", "WAITLISTED"];

// ---------------------------------------------------------------------------
// BL-11: Pay for a booking (UC-04 steps 4-6)
// POST /api/bookings/:bookingId/payment
// ---------------------------------------------------------------------------
router.post("/:bookingId/payment", authenticateToken, async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: "Invalid booking ID." });
  }

  try {
    await releaseExpiredHolds();

    
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    if (
      !booking.userId ||
      booking.userId.toString() !== req.user.userId
    ) {
      return res.status(403).json({
        message: "You are not authorized to pay for this booking.",
      });
    }


    if (booking.status === "CONFIRMED") {
      return res.status(409).json({
        message: "This booking is already paid and confirmed.",
        booking: toPublicBooking(booking),
      });
    }
    if (booking.status === "CANCELLED") {
      return res.status(409).json({ message: "This booking has been cancelled." });
    }
    if (booking.status === "EXPIRED") {
      return res.status(410).json({
        message: "The payment window for this booking has expired. Please book again.",
      });
    }

    const validation = validatePaymentDetails(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    // The amount always comes from the booking stored on the server, never from the client.
    const result = await processPayment(validation.details, booking.totalAmount);

    if (!result.success) {
      // UC-04 alternate flow 4a-4c: booking stays unconfirmed and the passenger may retry.
      await Booking.updateOne(
        { _id: booking._id, status: "PENDING_PAYMENT" },
        {
          $set: {
            payment: {
              paymentId: result.paymentId,
              method: result.method,
              maskedReference: result.maskedReference,
              amount: result.amount,
              status: "FAILED",
              failureReason: result.reason,
            },
          },
        }
      );

      return res.status(402).json({
        message: result.reason,
        bookingStatus: "PENDING_PAYMENT",
      });
    }

    // Payment succeeded: confirm the booking and generate a unique PNR (BL-12).
    // A booking made against the waitlist (BL-14) gets its PNR too but joins the queue
    // as WAITLISTED instead of being confirmed straight away.
    const joiningWaitlist = Boolean(booking.isWaitlist);
    let confirmed = null;

    for (let attempt = 0; attempt < 5 && !confirmed; attempt++) {
      try {
        confirmed = await Booking.findOneAndUpdate(
          { _id: booking._id, status: "PENDING_PAYMENT" },
          {
            $set: {
              status: joiningWaitlist ? "WAITLISTED" : "CONFIRMED",
              ...(joiningWaitlist ? { waitlistedAt: new Date() } : {}),
              pnr: generatePnr(),
              payment: {
                paymentId: result.paymentId,
                method: result.method,
                maskedReference: result.maskedReference,
                amount: result.amount,
                status: "PAID",
                paidAt: new Date(),
              },
            },
            $unset: { holdExpiresAt: "" },
          },
          { new: true }
        );
        break;
      } catch (error) {
        if (error.code !== DUPLICATE_KEY) throw error;
        // PNR collision: loop and try a new number.
      }
    }

    if (!confirmed) {
      return res.status(409).json({
        message: "This booking can no longer be paid. Please check its status.",
      });
    }

    let message = "Payment successful. Your booking is confirmed.";

    if (joiningWaitlist) {
      // Seats may already be free (for example after a cancellation while the passenger was
      // paying): clear the queue now so the response shows the true status.
      await promoteWaitlist(keyOf(confirmed));
      confirmed = (await Booking.findById(confirmed._id)) || confirmed;

      message =
        confirmed.status === "CONFIRMED"
          ? "Payment successful. Seats were available, so your ticket is confirmed."
          : "Payment successful. Your ticket is on the waitlist and will be confirmed automatically if seats become available.";
    }

    return res.status(200).json({
      message,
      booking: toPublicBooking(confirmed),
    });
  } catch (error) {
    console.error("Payment failed:", error.message);
    return res.status(500).json({ message: "Unable to process payment." });
  }
});

// ---------------------------------------------------------------------------
// BL-12: View booking confirmation and PNR (UC-05)
// GET /api/bookings/pnr/:pnr
// ---------------------------------------------------------------------------
router.get("/pnr/:pnr", async (req, res) => {
  const pnr = String(req.params.pnr).trim();

  if (!isValidPnrFormat(pnr)) {
    return res.status(400).json({ message: "PNR must be a 10-digit number." });
  }

  try {
    let booking = await Booking.findOne({ pnr });

    if (!booking) {
      return res.status(404).json({ message: "No booking found for this PNR." });
    }

    // BL-14: a waitlisted ticket may have been confirmed (or auto-cancelled) since it was saved.
    booking = await syncWaitlistedBooking(booking);

    return res.status(200).json({ booking: toPublicBooking(booking) });
  } catch (error) {
    console.error("PNR lookup failed:", error.message);
    return res.status(500).json({ message: "Unable to retrieve booking." });
  }
});

// ---------------------------------------------------------------------------
// BL-13: Preview the refund before cancelling
// GET /api/bookings/pnr/:pnr/refund-preview
// ---------------------------------------------------------------------------
router.get("/pnr/:pnr/refund-preview", async (req, res) => {
  const pnr = String(req.params.pnr).trim();

  if (!isValidPnrFormat(pnr)) {
    return res.status(400).json({ message: "PNR must be a 10-digit number." });
  }

  try {
    let booking = await Booking.findOne({ pnr }).lean();

    if (!booking) {
      return res.status(404).json({ message: "No booking found for this PNR." });
    }

    booking = await syncWaitlistedBooking(booking);

    if (booking.status === "CANCELLED") {
      return res.status(409).json({ message: "This ticket is already cancelled." });
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return res
        .status(400)
        .json({ message: "Only confirmed or waitlisted tickets can be cancelled." });
    }

    const refund = calculateRefund(booking);

    if (!refund.cancellable) {
      return res.status(400).json({ message: refund.reason });
    }

    return res.status(200).json({ refund });
  } catch (error) {
    console.error("Refund preview failed:", error.message);
    return res.status(500).json({ message: "Unable to calculate refund." });
  }
});

// ---------------------------------------------------------------------------
// BL-13: Cancel a ticket and process the refund (UC-06)
// POST /api/bookings/pnr/:pnr/cancel
// ---------------------------------------------------------------------------
router.post("/pnr/:pnr/cancel", async (req, res) => {
  const pnr = String(req.params.pnr).trim();

  if (!isValidPnrFormat(pnr)) {
    return res.status(400).json({ message: "PNR must be a 10-digit number." });
  }

  try {
    let booking = await Booking.findOne({ pnr }).lean();

    if (!booking) {
      return res.status(404).json({ message: "No booking found for this PNR." });
    }

    booking = await syncWaitlistedBooking(booking);

    // UC-06 alternate flow: a ticket cannot be cancelled twice.
    if (booking.status === "CANCELLED") {
      return res.status(409).json({ message: "This ticket is already cancelled." });
    }
    if (!CANCELLABLE_STATUSES.includes(booking.status)) {
      return res
        .status(400)
        .json({ message: "Only confirmed or waitlisted tickets can be cancelled." });
    }

    const refund = calculateRefund(booking);

    if (!refund.cancellable) {
      return res.status(400).json({ message: refund.reason });
    }

    const now = new Date();

    // Atomic status guard: if two cancel requests arrive together only one succeeds,
    // so seats are never released twice (NFR-03 / NFR-06).
    const wasConfirmed = booking.status === "CONFIRMED";

    const cancelled = await Booking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: "PASSENGER",
          refund: {
            refundId: generateRefundId(),
            status: refund.refundAmount > 0 ? "PROCESSED" : "NOT_ELIGIBLE",
            percentage: refund.percentage,
            amount: refund.refundAmount,
            deduction: refund.deduction,
            processedAt: now,
          },
        },
      },
      { new: true }
    );

    if (!cancelled) {
      return res.status(409).json({ message: "This ticket is already cancelled." });
    }

    // A waitlisted ticket never held a seat, so only confirmed tickets release seats.
    // The freed seats then go to the passengers waiting in the queue (BL-14).
    if (wasConfirmed) {
      await SeatAvailability.updateOne(keyOf(booking), {
        $inc: { availableSeats: booking.seatCount },
      });
      await promoteWaitlist(keyOf(booking));
    }

    const message =
      refund.refundAmount > 0
        ? `Ticket cancelled. Refund of ₹${refund.refundAmount} has been processed to your original payment method.`
        : "Ticket cancelled. No refund is applicable this close to departure.";

    return res.status(200).json({
      message,
      booking: toPublicBooking(cancelled),
      refund,
    });
  } catch (error) {
    console.error("Cancellation failed:", error.message);
    return res.status(500).json({ message: "Unable to cancel ticket." });
  }
});

module.exports = router;
