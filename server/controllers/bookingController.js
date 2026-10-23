const Booking = require("../models/Booking");

// Get a confirmed booking by its booking ID
exports.getBookingConfirmation = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.bookingId,
      userId: req.user.id,
      status: "CONFIRMED",
      paymentStatus: "PAID"
    }).select("-__v");

    if (!booking) {
      return res.status(404).json({
        message: "Confirmed booking not found"
      });
    }

    return res.status(200).json({
      message: "Booking confirmation retrieved successfully",
      confirmation: {
        pnr: booking.pnr,
        trainId: booking.trainId,
        journeyDate: booking.journeyDate,
        passengers: booking.passengers,
        totalAmount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus
      }
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid booking ID"
      });
    }

    return res.status(500).json({
      message: "Unable to retrieve booking confirmation"
    });
  }
};

// Find a confirmed booking using its PNR
exports.getBookingByPNR = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      pnr: req.params.pnr,
      userId: req.user.id,
      status: "CONFIRMED",
      paymentStatus: "PAID"
    }).select("-__v");

    if (!booking) {
      return res.status(404).json({
        message: "Confirmed booking not found for this PNR"
      });
    }

    return res.status(200).json({
      message: "Booking confirmation retrieved successfully",
      confirmation: {
        pnr: booking.pnr,
        trainId: booking.trainId,
        journeyDate: booking.journeyDate,
        passengers: booking.passengers,
        totalAmount: booking.totalAmount,
        status: booking.status,
        paymentStatus: booking.paymentStatus
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to retrieve booking confirmation"
    });
  }
};
// Cancel an eligible confirmed booking and record its refund status.
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user && req.user.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication is required"
      });
    }

    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID"
      });
    }

    // Atomic update prevents two concurrent requests from cancelling
    // the same booking more than once.
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        userId,
        status: "CONFIRMED",
        paymentStatus: "PAID"
      },
      {
        $set: {
          status: "CANCELLED",
          refundAmount: null,
          refundStatus: "PENDING_POLICY",
          cancelledAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).select("-__v");

    if (booking) {
      return res.status(200).json({
        message: "Booking cancelled. Refund eligibility and amount require the configured cancellation policy.",
        booking: {
          bookingId: booking._id,
          pnr: booking.pnr,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          refundAmount: booking.refundAmount,
          refundStatus: booking.refundStatus,
          cancelledAt: booking.cancelledAt
        }
      });
    }

    // If the atomic update did not match, distinguish an already
    // cancelled booking from an invalid, unowned or ineligible one.
    const existing = await Booking.findOne({
      _id: bookingId,
      userId
    }).select("status paymentStatus");

    if (!existing) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    if (existing.status === "CANCELLED") {
      return res.status(409).json({
        message: "Booking has already been cancelled"
      });
    }

    return res.status(409).json({
      message: "Only confirmed, paid bookings can be cancelled",
      status: existing.status,
      paymentStatus: existing.paymentStatus
    });
  } catch (error) {
    console.error("Booking cancellation failed:", error.message);
    return res.status(500).json({
      message: "Unable to cancel booking"
    });
  }
};
