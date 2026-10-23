
const mongoose = require("mongoose");

const passengerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    age: {
      type: Number,
      required: true,
      min: 1,
      max: 120
    },
    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"]
    }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    trainId: {
      type: String,
      required: true,
      trim: true
    },
    trainNumber: {
      type: String,
      required: true,
      trim: true
    },
    trainName: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      required: true,
      trim: true
    },
    destination: {
      type: String,
      required: true,
      trim: true
    },
    journeyDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    travelClass: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    passengers: {
      type: [passengerSchema],
      required: true,
      validate: {
        validator: (passengers) =>
          passengers.length >= 1 && passengers.length <= 6,
        message: "A booking must have between 1 and 6 passengers."
      }
    },
    seatCount: {
      type: Number,
      required: true,
      min: 1,
      max: 6
    },
    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED"],
      default: "CONFIRMED"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
