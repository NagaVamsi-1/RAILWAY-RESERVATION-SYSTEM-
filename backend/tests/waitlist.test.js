// Integration tests for BL-14 (waitlist monitoring, UC-07 / TC_08) against a real MongoDB.
// They only run when MONGODB_TEST_URI is set (a throw-away database, NOT your Atlas data), e.g.
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/railway_test npm test
const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const TEST_URI = process.env.MONGODB_TEST_URI;
const skip = TEST_URI ? false : "Set MONGODB_TEST_URI to run integration tests";

const app = require("../src/server");
const Booking = require("../src/models/Booking");
const SeatAvailability = require("../src/models/SeatAvailability");
const { MAX_WAITLIST_SEATS } = require("../src/config/waitlist");

function futureDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DATE = futureDate(10);
const upi = { method: "UPI", upiId: "ravi@okbank" };
const pax = (n = 1) =>
  Array.from({ length: n }, (_, i) => ({ name: `Passenger ${i + 1}`, age: 30, gender: "Male" }));

// Three different signed-in passengers.
const ids = {
  asha: new mongoose.Types.ObjectId().toString(),
  ben: new mongoose.Types.ObjectId().toString(),
  chitra: new mongoose.Types.ObjectId().toString(),
};
const auth = (user) => ({
  Authorization: `Bearer ${jwt.sign({ userId: ids[user] }, process.env.JWT_SECRET)}`,
});

async function seed(available) {
  await SeatAvailability.deleteMany({});
  await Booking.deleteMany({});
  await SeatAvailability.create({
    trainId: "12657",
    trainNumber: "12657",
    journeyDate: DATE,
    travelClass: "3A",
    totalSeats: 64,
    availableSeats: available,
  });
}

const seatsLeft = async () =>
  (await SeatAvailability.findOne({ trainId: "12657", journeyDate: DATE, travelClass: "3A" }))
    .availableSeats;

const create = (user, passengers, extra = {}) =>
  request(app)
    .post("/api/bookings")
    .set(auth(user))
    .send({ trainId: "12657", journeyDate: DATE, travelClass: "3A", passengers, ...extra });

const pay = (user, id) =>
  request(app).post(`/api/bookings/${id}/payment`).set(auth(user)).send(upi);

// A normal booking that takes real seats and is confirmed.
async function confirmedTicket(user, n = 1) {
  const created = await create(user, pax(n));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const paid = await pay(user, created.body.booking._id);
  assert.equal(paid.body.booking.status, "CONFIRMED");
  return { id: created.body.booking._id, pnr: paid.body.booking.pnr };
}

// A booking made against a sold-out class: pays and joins the queue.
async function waitlistedTicket(user, n = 1) {
  const created = await create(user, pax(n), { joinWaitlist: true });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const paid = await pay(user, created.body.booking._id);
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  return { id: created.body.booking._id, pnr: paid.body.booking.pnr, paid };
}

const status = (user, pnr) => request(app).get(`/api/waitlist/${pnr}`).set(auth(user));
const cancel = (pnr) => request(app).post(`/api/bookings/pnr/${pnr}/cancel`);

describe("BL-14 waitlist monitoring", { skip }, () => {
  before(() => mongoose.connect(TEST_URI));
  after(() => mongoose.disconnect());

  describe("joining the waitlist", () => {
    beforeEach(() => seed(0));

    test("a sold-out class is refused by default but the passenger is told the waitlist is open", async () => {
      const res = await create("asha", pax());
      assert.equal(res.status, 409);
      assert.equal(res.body.canJoinWaitlist, true);
      assert.equal(res.body.waitlistSeatsRemaining, MAX_WAITLIST_SEATS);
    });

    test("joining the waitlist creates an unpaid booking that holds no seats", async () => {
      const res = await create("asha", pax(2), { joinWaitlist: true });
      assert.equal(res.status, 201);
      assert.equal(res.body.booking.status, "PENDING_PAYMENT");
      assert.equal(res.body.booking.isWaitlist, true);
      assert.equal(res.body.booking.totalAmount, 1700);
      assert.match(res.body.message, /waitlist/i);
      assert.equal(await seatsLeft(), 0);
    });

    test("paying gives a PNR and the WAITLISTED status, not a confirmation", async () => {
      const { paid } = await waitlistedTicket("asha");
      assert.equal(paid.body.booking.status, "WAITLISTED");
      assert.match(paid.body.booking.pnr, /^[1-9]\d{9}$/);
      assert.ok(paid.body.booking.waitlistedAt);
      assert.match(paid.body.message, /waitlist/i);
      assert.equal(await seatsLeft(), 0);
    });

    test("joinWaitlist is ignored when seats are available: a normal seat hold is made", async () => {
      await seed(5);
      const res = await create("asha", pax(2), { joinWaitlist: true });
      assert.equal(res.status, 201);
      assert.equal(res.body.booking.isWaitlist, false);
      assert.equal(await seatsLeft(), 3);
    });

    test("an unconfigured class cannot be waitlisted", async () => {
      await SeatAvailability.deleteMany({});
      const res = await create("asha", pax(), { joinWaitlist: true });
      assert.equal(res.status, 404);
    });

    test("the waitlist has a limit and refuses bookings that do not fit", async () => {
      for (let i = 0; i < 3; i++) {
        assert.equal((await create("asha", pax(6), { joinWaitlist: true })).status, 201);
      }
      const tooMany = await create("ben", pax(3), { joinWaitlist: true });
      assert.equal(tooMany.status, 409);
      assert.match(tooMany.body.message, /waitlist.*full/i);
      assert.equal(tooMany.body.canJoinWaitlist, false);

      const exactFit = await create("ben", pax(2), { joinWaitlist: true });
      assert.equal(exactFit.status, 201);
    });

    test("seat availability reports how much of the waitlist is taken", async () => {
      await waitlistedTicket("asha", 2);
      const res = await request(app)
        .get("/api/seats/availability")
        .query({ trainId: "12657", date: DATE, travelClass: "3A" });
      assert.equal(res.status, 200);
      assert.equal(res.body.availableSeats, 0);
      assert.equal(res.body.waitlistedSeats, 2);
      assert.equal(res.body.waitlistSeatsRemaining, MAX_WAITLIST_SEATS - 2);
    });

    test("an unpaid waitlist request that times out releases no seats", async () => {
      const created = await create("asha", pax(2), { joinWaitlist: true });
      await Booking.updateOne(
        { _id: created.body.booking._id },
        { holdExpiresAt: new Date(Date.now() - 1000) }
      );
      const res = await pay("asha", created.body.booking._id);
      assert.equal(res.status, 410);
      assert.equal((await Booking.findById(created.body.booking._id)).status, "EXPIRED");
      assert.equal(await seatsLeft(), 0);
    });

    test("if seats free up while the passenger is paying, the ticket is confirmed straight away", async () => {
      const created = await create("asha", pax(), { joinWaitlist: true });
      assert.equal(created.status, 201);
      assert.equal(created.body.booking.isWaitlist, true);
      await SeatAvailability.updateOne({ trainId: "12657", journeyDate: DATE }, { availableSeats: 1 });
      const paid = await pay("asha", created.body.booking._id);
      assert.equal(paid.status, 200);
      assert.equal(paid.body.booking.status, "CONFIRMED");
      assert.equal(await seatsLeft(), 0);
    });
  });

  describe("monitoring (UC-07, TC_08)", () => {
    beforeEach(() => seed(1));

    test("shows the current position and queue details for a waitlisted ticket", async () => {
      await confirmedTicket("asha");
      const first = await waitlistedTicket("ben");
      const second = await waitlistedTicket("chitra", 2);

      const one = await status("ben", first.pnr);
      assert.equal(one.status, 200);
      assert.equal(one.body.booking.status, "WAITLISTED");
      assert.equal(one.body.waitlist.state, "WAITING");
      assert.equal(one.body.waitlist.label, "WL/1");
      assert.equal(one.body.waitlist.position, 1);
      assert.equal(one.body.waitlist.bookingsAhead, 0);
      assert.equal(one.body.waitlist.queueLength, 2);

      const two = await status("chitra", second.pnr);
      assert.equal(two.body.waitlist.label, "WL/2");
      assert.equal(two.body.waitlist.bookingsAhead, 1);
      assert.equal(two.body.waitlist.seatsAhead, 1);
      assert.equal(two.body.waitlist.seatsRequired, 2);
    });

    test("a non-existing PNR gives a not-found message and a malformed one a clear error", async () => {
      const missing = await status("ben", "9999999999");
      assert.equal(missing.status, 404);
      assert.match(missing.body.message, /no booking/i);
      assert.equal((await status("ben", "abc")).status, 400);
    });

    test("a ticket that was never waitlisted is not shown as one", async () => {
      const normal = await confirmedTicket("asha");
      const res = await status("asha", normal.pnr);
      assert.equal(res.status, 400);
      assert.match(res.body.message, /never/i);
    });

    test("login is required and a passenger cannot see someone else's waitlist ticket (SR-07)", async () => {
      await confirmedTicket("asha");
      const mine = await waitlistedTicket("ben");

      assert.equal((await request(app).get(`/api/waitlist/${mine.pnr}`)).status, 401);
      assert.equal((await request(app).get("/api/waitlist")).status, 401);

      const other = await status("chitra", mine.pnr);
      assert.equal(other.status, 404);
      assert.ok(!JSON.stringify(other.body).includes("Passenger"));
    });

    test("lists only the signed-in passenger's waitlisted tickets", async () => {
      await confirmedTicket("asha");
      const ben = await waitlistedTicket("ben");
      await waitlistedTicket("chitra");

      const res = await request(app).get("/api/waitlist").set(auth("ben"));
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.items[0].booking.pnr, ben.pnr);
      assert.equal(res.body.items[0].waitlist.label, "WL/1");

      const none = await request(app).get("/api/waitlist").set(auth("asha"));
      assert.equal(none.body.count, 0);
    });

    test("response never exposes internal fields", async () => {
      await confirmedTicket("asha");
      const ticket = await waitlistedTicket("ben");
      const res = await status("ben", ticket.pnr);
      assert.equal(res.body.booking.__v, undefined);
      assert.equal(res.body.booking.userId, undefined);
    });
  });

  describe("clearing the waitlist", () => {
    beforeEach(() => seed(1));

    test("a cancellation confirms the head of the queue first and the rest move up", async () => {
      const owner = await confirmedTicket("asha");
      const first = await waitlistedTicket("ben");
      const second = await waitlistedTicket("chitra");
      assert.equal(await seatsLeft(), 0);

      const res = await cancel(owner.pnr);
      assert.equal(res.status, 200);

      const benNow = await status("ben", first.pnr);
      assert.equal(benNow.body.booking.status, "CONFIRMED");
      assert.equal(benNow.body.waitlist.state, "CONFIRMED");
      assert.ok(benNow.body.booking.confirmedFromWaitlistAt);

      const chitraNow = await status("chitra", second.pnr);
      assert.equal(chitraNow.body.booking.status, "WAITLISTED");
      assert.equal(chitraNow.body.waitlist.label, "WL/1");

      // The freed seat went to the passenger, so none is left over (no double counting).
      assert.equal(await seatsLeft(), 0);
    });

    test("an expired payment hold frees seats for the waitlist", async () => {
      // Asha starts a booking for the last seat and never pays.
      const holding = await create("asha", pax());
      assert.equal(holding.status, 201);
      const waiting = await waitlistedTicket("ben");
      assert.equal((await status("ben", waiting.pnr)).body.booking.status, "WAITLISTED");

      await Booking.updateOne(
        { _id: holding.body.booking._id },
        { holdExpiresAt: new Date(Date.now() - 1000) }
      );

      const res = await status("ben", waiting.pnr);
      assert.equal(res.body.booking.status, "CONFIRMED");
      assert.equal(await seatsLeft(), 0);
    });

    test("the queue is strictly first-come-first-served: a big booking at the head is not skipped", async () => {
      await seed(3);
      const a = await confirmedTicket("asha", 1);
      const e = await confirmedTicket("asha", 2);
      assert.equal(await seatsLeft(), 0);

      const head = await waitlistedTicket("ben", 2);
      const behind = await waitlistedTicket("chitra", 1);

      // One seat frees up: the head needs two, so nobody is promoted.
      await cancel(a.pnr);
      assert.equal((await status("ben", head.pnr)).body.booking.status, "WAITLISTED");
      assert.equal((await status("chitra", behind.pnr)).body.booking.status, "WAITLISTED");
      assert.equal(await seatsLeft(), 1);

      // Two more free up: both are confirmed, head first.
      await cancel(e.pnr);
      assert.equal((await status("ben", head.pnr)).body.booking.status, "CONFIRMED");
      assert.equal((await status("chitra", behind.pnr)).body.booking.status, "CONFIRMED");
      assert.equal(await seatsLeft(), 0);
    });

    test("new bookings cannot jump the queue for freed seats", async () => {
      const owner = await confirmedTicket("asha");
      const waiting = await waitlistedTicket("ben");
      await cancel(owner.pnr);

      // The seat already went to Ben, so a new booking sees a sold-out class.
      const late = await create("chitra", pax());
      assert.equal(late.status, 409);
      assert.equal((await status("ben", waiting.pnr)).body.booking.status, "CONFIRMED");
    });

    test("the PNR lookup page also shows a waitlisted ticket that has just been confirmed", async () => {
      const owner = await confirmedTicket("asha");
      const waiting = await waitlistedTicket("ben");
      // Seats are freed behind the scenes (for example a seat count correction).
      await Booking.updateOne({ pnr: owner.pnr }, { status: "CANCELLED" });
      await SeatAvailability.updateOne({ trainId: "12657", journeyDate: DATE }, { availableSeats: 1 });

      const res = await request(app).get(`/api/bookings/pnr/${waiting.pnr}`);
      assert.equal(res.body.booking.status, "CONFIRMED");
    });
  });

  describe("cancelling and expiry", () => {
    beforeEach(() => seed(1));

    test("cancelling a waitlisted ticket refunds in full, releases no seats and moves the queue up", async () => {
      await confirmedTicket("asha");
      const first = await waitlistedTicket("ben");
      const second = await waitlistedTicket("chitra");
      assert.equal(await seatsLeft(), 0);

      const preview = await request(app).get(`/api/bookings/pnr/${first.pnr}/refund-preview`);
      assert.equal(preview.status, 200);
      assert.equal(preview.body.refund.percentage, 100);
      assert.equal(preview.body.refund.refundAmount, 850);

      const res = await cancel(first.pnr);
      assert.equal(res.status, 200);
      assert.equal(res.body.booking.status, "CANCELLED");
      assert.equal(res.body.booking.refund.amount, 850);
      assert.equal(res.body.booking.refund.deduction, 0);
      assert.equal(res.body.booking.cancellationReason, "PASSENGER");
      assert.equal(await seatsLeft(), 0);

      assert.equal((await status("chitra", second.pnr)).body.waitlist.label, "WL/1");
    });

    test("a waitlisted ticket cannot be cancelled twice", async () => {
      await confirmedTicket("asha");
      const ticket = await waitlistedTicket("ben");
      assert.equal((await cancel(ticket.pnr)).status, 200);
      assert.equal((await cancel(ticket.pnr)).status, 409);
      assert.equal(await seatsLeft(), 0);
    });

    test("a ticket still waitlisted when the train departs is cancelled with a full refund", async () => {
      await confirmedTicket("asha");
      const ticket = await waitlistedTicket("ben");
      await Booking.updateOne({ pnr: ticket.pnr }, { journeyDate: futureDate(-2) });

      const res = await status("ben", ticket.pnr);
      assert.equal(res.status, 200);
      assert.equal(res.body.booking.status, "CANCELLED");
      assert.equal(res.body.booking.cancellationReason, "WAITLIST_NOT_CLEARED");
      assert.equal(res.body.booking.refund.amount, 850);
      assert.equal(res.body.waitlist.state, "NOT_CLEARED");
    });

    test("confirmed tickets still behave as before: cancel releases the seat", async () => {
      await seed(5);
      const ticket = await confirmedTicket("asha", 2);
      assert.equal(await seatsLeft(), 3);
      assert.equal((await cancel(ticket.pnr)).status, 200);
      assert.equal(await seatsLeft(), 5);
    });
  });
});
