const mongoose = require("mongoose");

const passengerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    age: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    pnr: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    trainId: {
      type: String,
      required: true
    },
    journeyDate: {
      type: Date,
      required: true
    },
    passengers: {
      type: [passengerSchema],
      required: true
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
      default: "PENDING_PAYMENT"
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING"
    },
    refundAmount: {
      type: Number,
      min: 0,
      default: null
    },
    refundStatus: {
      type: String,
      enum: [
        "NOT_REQUESTED",
        "PENDING_POLICY",
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "NOT_ELIGIBLE"
      ],
      default: "NOT_REQUESTED"
    },
    cancelledAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);