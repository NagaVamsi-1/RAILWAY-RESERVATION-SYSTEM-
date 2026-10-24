// Integration tests for BL-10 → BL-13 against a real MongoDB.
// They only run when MONGODB_TEST_URI is set (a throw-away database, NOT your Atlas data), e.g.
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/railway_test npm test
const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");

const TEST_URI = process.env.MONGODB_TEST_URI;
const skip = TEST_URI ? false : "Set MONGODB_TEST_URI to run integration tests";

const app = require("../src/server");
const Booking = require("../src/models/Booking");
const SeatAvailability = require("../src/models/SeatAvailability");

function futureDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DATE = futureDate(10);
const passenger = { name: "Ravi Kumar", age: 21, gender: "Male" };
const upi = { method: "UPI", upiId: "ravi@okbank" };

async function seed(available = 42) {
  await SeatAvailability.deleteMany({});
  await Booking.deleteMany({});
  await SeatAvailability.create({
    trainId: "12657", trainNumber: "12657", journeyDate: DATE,
    travelClass: "3A", totalSeats: 64, availableSeats: available,
  });
}

const seatsLeft = async () =>
  (await SeatAvailability.findOne({ trainId: "12657", journeyDate: DATE, travelClass: "3A" })).availableSeats;

function createBooking(passengers = [passenger]) {
  return request(app).post("/api/bookings").send({
    trainId: "12657", journeyDate: DATE, travelClass: "3A", passengers,
  });
}

async function bookAndPay(passengers = [passenger]) {
  const created = await createBooking(passengers);
  const paid = await request(app).post(`/api/bookings/${created.body.booking._id}/payment`).send(upi);
  return { created, paid, pnr: paid.body.booking?.pnr };
}

describe("BL-11/12/13 booking lifecycle", { skip }, () => {
  before(() => mongoose.connect(TEST_URI));
  after(() => mongoose.disconnect());
  beforeEach(() => seed());

  test("booking holds seats, is PENDING_PAYMENT, has no PNR and a server-side fare", async () => {
    const res = await createBooking([passenger, { ...passenger, name: "Asha" }]);
    assert.equal(res.status, 201);
    assert.equal(res.body.booking.status, "PENDING_PAYMENT");
    assert.equal(res.body.booking.pnr, null);
    assert.equal(res.body.booking.totalAmount, 1700);
    assert.equal(await seatsLeft(), 40);
  });

  test("successful UPI payment confirms booking and generates a PNR (TC_05, TC_06)", async () => {
    const { paid } = await bookAndPay();
    assert.equal(paid.status, 200);
    assert.equal(paid.body.booking.status, "CONFIRMED");
    assert.match(paid.body.booking.pnr, /^[1-9]\d{9}$/);
    assert.equal(paid.body.booking.payment.status, "PAID");
    assert.equal(paid.body.booking.payment.amount, 850);
    assert.equal(paid.body.booking.payment.maskedReference, "ra***@okbank");
  });

  test("invalid UPI ID is rejected and booking is not confirmed", async () => {
    const created = await createBooking();
    const res = await request(app)
      .post(`/api/bookings/${created.body.booking._id}/payment`)
      .send({ method: "UPI", upiId: "invalid_format" });
    assert.equal(res.status, 400);
    const stored = await Booking.findById(created.body.booking._id);
    assert.equal(stored.status, "PENDING_PAYMENT");
    assert.equal(stored.pnr, undefined);
  });

  test("declined payment keeps booking unconfirmed and allows retry (UC-04 4a-4c)", async () => {
    const created = await createBooking();
    const id = created.body.booking._id;
    const declined = await request(app).post(`/api/bookings/${id}/payment`)
      .send({ method: "UPI", upiId: "ravi@failbank" });
    assert.equal(declined.status, 402);
    assert.equal((await Booking.findById(id)).status, "PENDING_PAYMENT");

    const retry = await request(app).post(`/api/bookings/${id}/payment`).send(upi);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.booking.status, "CONFIRMED");
  });

  test("paying twice does not create a second payment or new PNR", async () => {
    const { created, pnr } = await bookAndPay();
    const again = await request(app).post(`/api/bookings/${created.body.booking._id}/payment`).send(upi);
    assert.equal(again.status, 409);
    assert.equal((await Booking.findById(created.body.booking._id)).pnr, pnr);
  });

  test("concurrent payments confirm exactly once", async () => {
    const created = await createBooking();
    const id = created.body.booking._id;
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post(`/api/bookings/${id}/payment`).send(upi))
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
  });

  test("card payment works and the card number is never stored", async () => {
    const created = await createBooking();
    const res = await request(app).post(`/api/bookings/${created.body.booking._id}/payment`).send({
      method: "CARD", cardNumber: "4242424242424242", cardHolder: "Ravi Kumar", expiry: "12/35", cvv: "123",
    });
    assert.equal(res.status, 200);
    const raw = JSON.stringify(await Booking.findById(created.body.booking._id).lean());
    assert.ok(!raw.includes("4242424242424242"));
    assert.ok(!raw.includes("123\""));
    assert.equal(res.body.booking.payment.maskedReference, "**** **** **** 4242");
  });

  test("expired hold is released and cannot be paid", async () => {
    const created = await createBooking();
    const id = created.body.booking._id;
    assert.equal(await seatsLeft(), 41);
    await Booking.updateOne({ _id: id }, { holdExpiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).post(`/api/bookings/${id}/payment`).send(upi);
    assert.equal(res.status, 410);
    assert.equal(await seatsLeft(), 42);
    assert.equal((await Booking.findById(id)).status, "EXPIRED");
  });

  test("PNR lookup returns the booking; unknown or malformed PNR gives clear errors (TC_06)", async () => {
    const { pnr } = await bookAndPay();
    const ok = await request(app).get(`/api/bookings/pnr/${pnr}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.booking.pnr, pnr);
    assert.equal((await request(app).get("/api/bookings/pnr/9999999999")).status, 404);
    assert.equal((await request(app).get("/api/bookings/pnr/abc")).status, 400);
  });

  test("cancelling a ticket 10 days out refunds 90% and restores seats (TC_07)", async () => {
    const { pnr } = await bookAndPay();
    assert.equal(await seatsLeft(), 41);

    const preview = await request(app).get(`/api/bookings/pnr/${pnr}/refund-preview`);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.refund.refundAmount, 765);

    const res = await request(app).post(`/api/bookings/pnr/${pnr}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.booking.status, "CANCELLED");
    assert.equal(res.body.booking.refund.status, "PROCESSED");
    assert.equal(res.body.booking.refund.amount, 765);
    assert.equal(await seatsLeft(), 42);
  });

  test("cancelling twice is rejected and seats are not released twice", async () => {
    const { pnr } = await bookAndPay();
    await request(app).post(`/api/bookings/pnr/${pnr}/cancel`);
    const again = await request(app).post(`/api/bookings/pnr/${pnr}/cancel`);
    assert.equal(again.status, 409);
    assert.equal(await seatsLeft(), 42);
  });

  test("concurrent cancellations release seats once", async () => {
    const { pnr } = await bookAndPay();
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post(`/api/bookings/pnr/${pnr}/cancel`))
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(await seatsLeft(), 42);
  });

  test("unknown PNR cannot be cancelled; unpaid booking cannot be cancelled by PNR", async () => {
    assert.equal((await request(app).post("/api/bookings/pnr/9999999999/cancel")).status, 404);
  });

  test("ticket for a departed train cannot be cancelled", async () => {
    const { pnr } = await bookAndPay();
    await Booking.updateOne({ pnr }, { journeyDate: futureDate(-2) });
    const res = await request(app).post(`/api/bookings/pnr/${pnr}/cancel`);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /departed/i);
  });

  test("late cancellation (inside 4 hours) succeeds with no refund", async () => {
    const { pnr } = await bookAndPay();
    // Train 12657 departs 22:40 IST; move the journey so departure is ~1 hour away.
    const soon = new Date(Date.now() + 3600 * 1000 + 5.5 * 3600 * 1000); // shift to IST wall-clock
    const date = soon.toISOString().slice(0, 10);
    const time = soon.toISOString().slice(11, 16);
    await Booking.updateOne({ pnr }, { journeyDate: date, departure: time });
    const res = await request(app).post(`/api/bookings/pnr/${pnr}/cancel`);
    assert.equal(res.status, 200);
    assert.equal(res.body.booking.refund.status, "NOT_ELIGIBLE");
    assert.equal(res.body.booking.refund.amount, 0);
  });

  test("response never exposes internal payment failure reason or version key", async () => {
    const { pnr } = await bookAndPay();
    const res = await request(app).get(`/api/bookings/pnr/${pnr}`);
    assert.equal(res.body.booking.__v, undefined);
  });
});
