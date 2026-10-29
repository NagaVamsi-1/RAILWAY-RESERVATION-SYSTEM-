
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
        userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
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
    // Departure time (HH:mm, IST) copied from the train; used for refund rules.
    departure: {
      type: String,
      match: /^\d{2}:\d{2}$/
    },
    // BL-11: fare is fixed on the server when the booking is prepared.
    farePerPassenger: {
      type: Number,
      min: 0
    },
    totalAmount: {
      type: Number,
      min: 0
    },
    // BL-12: generated only after successful payment.
    pnr: {
      type: String,
      match: /^[1-9]\d{9}$/
    },
    // PENDING_PAYMENT: seats held, waiting for payment (UC-04)
    // CONFIRMED: paid, PNR generated
    // CANCELLED: cancelled by the passenger (BL-13)
    // EXPIRED: payment window ran out, seats released
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED"],
      default: "PENDING_PAYMENT"
    },
    holdExpiresAt: {
      type: Date
    },
    // Only masked payment data is stored (NFR-05 / SR-05): never card numbers, CVV or full UPI IDs.
    payment: {
      paymentId: String,
      method: { type: String, enum: ["UPI", "CARD"] },
      maskedReference: String,
      amount: Number,
      status: { type: String, enum: ["PAID", "FAILED"] },
      failureReason: String,
      paidAt: Date
    },
    // BL-13
    refund: {
      refundId: String,
      status: { type: String, enum: ["PROCESSED", "NOT_ELIGIBLE"] },
      percentage: Number,
      amount: Number,
      deduction: Number,
      processedAt: Date
    },
    cancelledAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// PNRs are unique; unpaid bookings have no PNR yet, so the index only covers real PNRs.
bookingSchema.index(
  { pnr: 1 },
  { unique: true, partialFilterExpression: { pnr: { $type: "string" } } }
);
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
