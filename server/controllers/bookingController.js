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