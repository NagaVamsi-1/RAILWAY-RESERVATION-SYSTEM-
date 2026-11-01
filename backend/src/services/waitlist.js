// BL-14: Waitlist monitoring (UC-07, FR-09, TC_08).
//
// Rules (documented assumptions, the SRS only says "waitlist status"):
//  * Only a class that is sold out can be waitlisted; the passenger pays up front and gets a
//    PNR with status WAITLISTED. No seat is held.
//  * The queue is first-come-first-served by payment time (strict FIFO: a large booking at
//    the head is never skipped by smaller ones behind it).
//  * Freed seats (cancellations, expired payment holds) promote the head of the queue to
//    CONFIRMED automatically.
//  * A ticket still waitlisted when the train departs is cancelled with a full refund.
const Booking = require("../models/Booking");
const SeatAvailability = require("../models/SeatAvailability");
const { MAX_WAITLIST_SEATS } = require("../config/waitlist");
const { generateRefundId, getDepartureDate } = require("./refund");

function keyOf(booking) {
  return {
    trainId: booking.trainId,
    journeyDate: booking.journeyDate,
    travelClass: booking.travelClass,
  };
}

/**
 * Seats currently taken in the waitlist for a train / date / class: paid waitlisted tickets
 * plus unpaid waitlist requests that are still inside their payment window.
 */
async function countWaitlistedSeats(key, now = new Date()) {
  const rows = await Booking.aggregate([
    {
      $match: {
        trainId: key.trainId,
        journeyDate: key.journeyDate,
        travelClass: key.travelClass,
        $or: [
          { status: "WAITLISTED" },
          { status: "PENDING_PAYMENT", isWaitlist: true, holdExpiresAt: { $gt: now } },
        ],
      },
    },
    { $group: { _id: null, seats: { $sum: "$seatCount" } } },
  ]);

  return rows.length ? rows[0].seats : 0;
}

/**
 * Confirms waitlisted tickets, oldest first, while enough seats are available.
 * Safe to call at any time and from concurrent requests: seats are taken with an atomic
 * conditional decrement and the ticket is promoted with an atomic status guard, and the
 * seats are given back if the ticket was cancelled in the meantime.
 */
async function promoteWaitlist(key) {
  let promoted = 0;

  // The cap only protects against an endless loop; a queue is at most MAX_WAITLIST_SEATS long.
  for (let i = 0; i < MAX_WAITLIST_SEATS + 5; i++) {
    const head = await Booking.findOne({ ...key, status: "WAITLISTED" })
      .sort({ waitlistedAt: 1, _id: 1 })
      .lean();

    if (!head) break;

    const seats = await SeatAvailability.findOneAndUpdate(
      { ...key, availableSeats: { $gte: head.seatCount } },
      { $inc: { availableSeats: -head.seatCount } }
    );

    // Not enough seats for the head of the queue: everyone behind it keeps waiting.
    if (!seats) break;

    const confirmed = await Booking.findOneAndUpdate(
      { _id: head._id, status: "WAITLISTED" },
      { $set: { status: "CONFIRMED", confirmedFromWaitlistAt: new Date() } },
      { new: true }
    );

    if (!confirmed) {
      // Cancelled while we were promoting it: put the seats back and look at the next one.
      await SeatAvailability.updateOne(key, { $inc: { availableSeats: head.seatCount } });
      continue;
    }

    promoted += 1;
  }

  return promoted;
}

/**
 * Cancels waitlisted tickets whose train has already departed and refunds them in full.
 * `filter` can narrow the search (for example to one train / date / class).
 */
async function expireDepartedWaitlist(now = new Date(), filter = {}) {
  // Only journeys that are today or earlier (plus a day of slack for time zones) can have departed.
  const latestDate = new Date(now.getTime() + 36e5 * 48).toISOString().slice(0, 10);

  const candidates = await Booking.find({
    ...filter,
    status: "WAITLISTED",
    journeyDate: { $lte: latestDate },
  }).lean();

  let cancelled = 0;

  for (const booking of candidates) {
    const departureAt = getDepartureDate(booking.journeyDate, booking.departure);

    if (Number.isNaN(departureAt.getTime()) || departureAt.getTime() > now.getTime()) continue;

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "WAITLISTED" },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: "WAITLIST_NOT_CLEARED",
          refund: {
            refundId: generateRefundId(),
            status: "PROCESSED",
            percentage: 100,
            amount: booking.totalAmount,
            deduction: 0,
            processedAt: now,
          },
        },
      }
    );

    if (updated) cancelled += 1;
  }

  return cancelled;
}

/**
 * Brings one booking up to date before it is shown: clears its queue and auto-cancels it if
 * the train has left. Returns the fresh booking (or the original when it is not waitlisted).
 */
async function syncWaitlistedBooking(booking, now = new Date()) {
  if (booking.status !== "WAITLISTED") return booking;

  const key = keyOf(booking);

  // Seats held by unpaid bookings whose time ran out may be what this ticket is waiting for.
  // Required here (not at the top) because holds.js itself uses this module.
  const { releaseExpiredHolds } = require("./holds");
  await releaseExpiredHolds(now);

  await promoteWaitlist(key);
  await expireDepartedWaitlist(now, { _id: booking._id });

  return (await Booking.findById(booking._id).lean()) || booking;
}

const MESSAGES = {
  WAITING: "Your ticket is on the waitlist. It will be confirmed automatically if seats become available.",
  CONFIRMED: "Good news: your waitlisted ticket is now confirmed.",
  NOT_CLEARED:
    "Your ticket stayed on the waitlist until the train departed, so it was cancelled and fully refunded.",
  CANCELLED: "This ticket has been cancelled.",
};

/**
 * Current waitlist status of a booking that is (or was) waitlisted.
 * `state` is a stable code the UI translates: WAITING | CONFIRMED | NOT_CLEARED | CANCELLED.
 */
async function getWaitlistInfo(booking) {
  const key = keyOf(booking);
  const availability = await SeatAvailability.findOne(key).lean();

  const info = {
    seatsRequired: booking.seatCount,
    seatsAvailable: availability ? availability.availableSeats : 0,
  };

  if (booking.status === "WAITLISTED") {
    const joinedAt = booking.waitlistedAt || booking.createdAt;
    const queue = { ...key, status: "WAITLISTED" };

    const ahead = await Booking.find({
      ...queue,
      $or: [
        { waitlistedAt: { $lt: joinedAt } },
        { waitlistedAt: joinedAt, _id: { $lt: booking._id } },
      ],
    })
      .select("seatCount")
      .lean();

    const queueLength = await Booking.countDocuments(queue);
    const position = ahead.length + 1;

    return {
      ...info,
      state: "WAITING",
      label: `WL/${position}`,
      position,
      bookingsAhead: ahead.length,
      seatsAhead: ahead.reduce((sum, item) => sum + item.seatCount, 0),
      queueLength,
      message: MESSAGES.WAITING,
    };
  }

  if (booking.status === "CONFIRMED") {
    return { ...info, state: "CONFIRMED", label: "CNF", message: MESSAGES.CONFIRMED };
  }

  if (booking.status === "CANCELLED") {
    const state = booking.cancellationReason === "WAITLIST_NOT_CLEARED" ? "NOT_CLEARED" : "CANCELLED";
    return { ...info, state, label: "CAN", message: MESSAGES[state] };
  }

  return { ...info, state: booking.status, label: booking.status, message: "" };
}

module.exports = {
  keyOf,
  countWaitlistedSeats,
  promoteWaitlist,
  expireDepartedWaitlist,
  syncWaitlistedBooking,
  getWaitlistInfo,
};
