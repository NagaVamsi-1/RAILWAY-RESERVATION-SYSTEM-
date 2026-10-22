
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const generatePNR = require("../utils/generatePNR");
const { verifyPayment } = require("../services/paymentService");

exports.confirmPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paymentReference } = req.body;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({
        message: "Invalid booking ID"
      });
    }

    if (
      typeof paymentReference !== "string" ||
      !paymentReference.trim()
    ) {
      return res.status(400).json({
        message: "Payment reference is required"
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      userId: req.user.id
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    if (booking.status === "CONFIRMED") {
      return res.status(409).json({
        message: "Booking is already confirmed"
      });
    }

    if (
      booking.status !== "PENDING_PAYMENT" ||
      booking.paymentStatus !== "PENDING"
    ) {
      return res.status(409).json({
        message: "Booking is not awaiting payment"
      });
    }

    const payment = await verifyPayment(paymentReference);

    if (!payment.verified) {
      return res.status(503).json({
        message: payment.reason,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus
      });
    }

    // Generate the PNR only after trusted payment verification.
    const pnr = generatePNR();

    booking.pnr = pnr;
    booking.paymentStatus = "PAID";
    booking.status = "CONFIRMED";

    await booking.save();

    return res.status(200).json({
      message: "Booking confirmed successfully",
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
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A duplicate PNR was detected; retry safely"
      });
    }

    console.error("Payment confirmation error:", error.message);

    return res.status(500).json({
      message: "Unable to confirm payment and booking"
    });
  }
};
