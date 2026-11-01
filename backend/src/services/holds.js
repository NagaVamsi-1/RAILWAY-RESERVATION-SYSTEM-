const Booking = require("../models/Booking");
const SeatAvailability = require("../models/SeatAvailability");
const { promoteWaitlist } = require("./waitlist");

/**
 * Releases seats held by unpaid bookings whose hold time has run out, so unpaid
 * reservations cannot block seats forever (NFR-03 / NFR-06 consistency).
 * Called lazily before availability, booking and payment operations.
 *
 * Unpaid waitlist requests (isWaitlist) never held any seats, so expiring them
 * releases nothing. Whenever real seats are freed, the waitlist for that train,
 * date and class is cleared first (BL-14).
 */
async function releaseExpiredHolds(now = new Date()) {
  const expired = await Booking.find({
    status: "PENDING_PAYMENT",
    holdExpiresAt: { $lte: now },
  }).lean();

  const freed = new Map();

  for (const held of expired) {
    // The status filter makes this atomic: only one caller can expire a given booking.
    const updated = await Booking.findOneAndUpdate(
      { _id: held._id, status: "PENDING_PAYMENT" },
      { $set: { status: "EXPIRED" } },
      { new: true }
    );

    if (updated && !held.isWaitlist) {
      const key = {
        trainId: held.trainId,
        journeyDate: held.journeyDate,
        travelClass: held.travelClass,
      };

      await SeatAvailability.updateOne(key, { $inc: { availableSeats: held.seatCount } });
      freed.set(`${key.trainId}|${key.journeyDate}|${key.travelClass}`, key);
    }
  }

  for (const key of freed.values()) {
    await promoteWaitlist(key);
  }

  return expired.length;
}

module.exports = { releaseExpiredHolds };
