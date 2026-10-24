const Booking = require("../models/Booking");
const SeatAvailability = require("../models/SeatAvailability");

/**
 * Releases seats held by unpaid bookings whose hold time has run out, so unpaid
 * reservations cannot block seats forever (NFR-03 / NFR-06 consistency).
 * Called lazily before availability, booking and payment operations.
 */
async function releaseExpiredHolds(now = new Date()) {
  const expired = await Booking.find({
    status: "PENDING_PAYMENT",
    holdExpiresAt: { $lte: now },
  }).lean();

  for (const held of expired) {
    // The status filter makes this atomic: only one caller can expire a given booking.
    const updated = await Booking.findOneAndUpdate(
      { _id: held._id, status: "PENDING_PAYMENT" },
      { $set: { status: "EXPIRED" } },
      { new: true }
    );

    if (updated) {
      await SeatAvailability.updateOne(
        { trainId: held.trainId, journeyDate: held.journeyDate, travelClass: held.travelClass },
        { $inc: { availableSeats: held.seatCount } }
      );
    }
  }

  return expired.length;
}

module.exports = { releaseExpiredHolds };
