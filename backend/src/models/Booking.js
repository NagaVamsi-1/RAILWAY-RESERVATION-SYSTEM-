
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
    // PENDING_PAYMENT: seats held (or a waitlist place requested), waiting for payment (UC-04)
    // CONFIRMED: paid, PNR generated
    // WAITLISTED: paid and in the waitlist queue, no seat yet (BL-14)
    // CANCELLED: cancelled by the passenger (BL-13) or auto-cancelled at departure (BL-14)
    // EXPIRED: payment window ran out, seats released
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "WAITLISTED", "CANCELLED", "EXPIRED"],
      default: "PENDING_PAYMENT"
    },
    // BL-14: true when the passenger asked to join the waitlist because the class was full.
    // Such a booking never holds seats; it is only promoted to CONFIRMED when seats free up.
    isWaitlist: {
      type: Boolean,
      default: false
    },
    // BL-14: when the paid ticket entered the waitlist queue (queue order = oldest first).
    waitlistedAt: {
      type: Date
    },
    // BL-14: set when a waitlisted ticket was automatically confirmed.
    confirmedFromWaitlistAt: {
      type: Date
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
    },
    // BL-14: PASSENGER = cancelled by the passenger, WAITLIST_NOT_CLEARED = still waitlisted
    // when the train departed (full refund).
    cancellationReason: {
      type: String,
      enum: ["PASSENGER", "WAITLIST_NOT_CLEARED"]
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
// BL-14: finding the waitlist queue for a train / date / class in order.
bookingSchema.index({
  trainId: 1,
  journeyDate: 1,
  travelClass: 1,
  status: 1,
  waitlistedAt: 1
});
bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
