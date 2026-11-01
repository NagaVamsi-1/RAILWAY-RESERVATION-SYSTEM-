// BL-14: Monitor waitlisted bookings (UC-07, FR-09, TC_08).
// Every route needs a login and only returns the signed-in passenger's own tickets (SR-07).
const express = require("express");

const Booking = require("../models/Booking");
const authenticateToken = require("../middleware/auth");
const { isValidPnrFormat } = require("../services/pnr");
const { releaseExpiredHolds } = require("../services/holds");
const { toPublicBooking } = require("../services/publicBooking");
const {
  keyOf,
  promoteWaitlist,
  expireDepartedWaitlist,
  syncWaitlistedBooking,
  getWaitlistInfo,
} = require("../services/waitlist");

const router = express.Router();

router.use(authenticateToken);

// Tickets that are waitlisted now, or were waitlisted at some point (so a ticket that has just
// been confirmed or cancelled still shows how its waitlist ended).
const ownWaitlistTickets = (userId) => ({
  userId,
  $or: [{ status: "WAITLISTED" }, { isWaitlist: true, pnr: { $type: "string" } }],
});

// ---------------------------------------------------------------------------
// GET /api/waitlist
// The passenger's waitlist section: every waitlisted ticket with its live position.
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const filter = ownWaitlistTickets(req.user.userId);

    await releaseExpiredHolds();

    // Bring the queues up to date first so the positions shown are current.
    const waiting = await Booking.find({ ...filter, status: "WAITLISTED" }).lean();
    const keys = new Map(
      waiting.map((booking) => {
        const key = keyOf(booking);
        return [`${key.trainId}|${key.journeyDate}|${key.travelClass}`, key];
      })
    );

    for (const key of keys.values()) {
      await promoteWaitlist(key);
    }
    await expireDepartedWaitlist(new Date(), { userId: req.user.userId });

    const tickets = await Booking.find(filter).sort({ createdAt: -1 }).lean();

    // Still-waiting tickets first, then the ones whose waitlist has ended.
    tickets.sort(
      (a, b) =>
        Number(b.status === "WAITLISTED") - Number(a.status === "WAITLISTED") ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const items = [];
    for (const ticket of tickets) {
      items.push({
        booking: toPublicBooking(ticket),
        waitlist: await getWaitlistInfo(ticket),
      });
    }

    return res.status(200).json({ count: items.length, items });
  } catch (error) {
    console.error("Waitlist listing failed:", error.message);
    return res.status(500).json({ message: "Unable to retrieve your waitlisted bookings." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/waitlist/:pnr
// Current waitlist status of one ticket (UC-07 main flow).
// ---------------------------------------------------------------------------
router.get("/:pnr", async (req, res) => {
  const pnr = String(req.params.pnr).trim();

  if (!isValidPnrFormat(pnr)) {
    return res.status(400).json({ message: "PNR must be a 10-digit number." });
  }

  try {
    // Another passenger's PNR gets the same "not found" answer as an unknown PNR so PNRs
    // cannot be probed (UC-07 alternate flow 2a, SR-07).
    let booking = await Booking.findOne({ pnr, userId: req.user.userId }).lean();

    if (!booking) {
      return res.status(404).json({ message: "No booking found for this PNR." });
    }

    booking = await syncWaitlistedBooking(booking);

    if (!booking.isWaitlist) {
      return res.status(400).json({ message: "This booking was never on a waitlist." });
    }

    return res.status(200).json({
      booking: toPublicBooking(booking),
      waitlist: await getWaitlistInfo(booking),
    });
  } catch (error) {
    console.error("Waitlist status failed:", error.message);
    return res.status(500).json({ message: "Unable to retrieve the waitlist status." });
  }
});

module.exports = router;
