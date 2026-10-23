
const mongoose = require("mongoose");

const seatAvailabilitySchema = new mongoose.Schema(
  {
    trainId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    trainNumber: {
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
    totalSeats: {
      type: Number,
      required: true,
      min: 0
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { timestamps: true }
);

seatAvailabilitySchema.index(
  { trainId: 1, journeyDate: 1, travelClass: 1 },
  { unique: true }
);

seatAvailabilitySchema.pre("validate", function () {
  if (this.availableSeats > this.totalSeats) {
    this.invalidate(
      "availableSeats",
      "Available seats cannot exceed total seats."
    );
  }
});

module.exports = mongoose.model(
  "SeatAvailability",
  seatAvailabilitySchema
);
