const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const { calculateRefund, getDepartureDate } = require("../src/services/refund");

const booking = { journeyDate: "2026-11-10", departure: "22:40", totalAmount: 850 };
const departure = getDepartureDate(booking.journeyDate, booking.departure);
const hoursBefore = (h) => new Date(departure.getTime() - h * 36e5);

describe("BL-13: refund rules", () => {
  test("departure is read as IST", () => {
    assert.equal(departure.toISOString(), "2026-11-10T17:10:00.000Z");
  });

  test("90% refund when cancelled 48+ hours before departure", () => {
    const r = calculateRefund(booking, hoursBefore(72));
    assert.equal(r.cancellable, true);
    assert.equal(r.percentage, 90);
    assert.equal(r.refundAmount, 765);
    assert.equal(r.deduction, 85);
  });

  test("75% refund between 12 and 48 hours", () => {
    const r = calculateRefund(booking, hoursBefore(24));
    assert.equal(r.percentage, 75);
    assert.equal(r.refundAmount, 637.5);
  });

  test("50% refund between 4 and 12 hours", () => {
    const r = calculateRefund(booking, hoursBefore(6));
    assert.equal(r.percentage, 50);
    assert.equal(r.refundAmount, 425);
  });

  test("no refund in the last 4 hours, but ticket can still be cancelled", () => {
    const r = calculateRefund(booking, hoursBefore(2));
    assert.equal(r.cancellable, true);
    assert.equal(r.refundAmount, 0);
  });

  test("tier boundaries are inclusive of the higher tier", () => {
    assert.equal(calculateRefund(booking, hoursBefore(48)).percentage, 90);
    assert.equal(calculateRefund(booking, hoursBefore(12)).percentage, 75);
    assert.equal(calculateRefund(booking, hoursBefore(4)).percentage, 50);
  });

  test("cannot cancel after the train has departed", () => {
    const r = calculateRefund(booking, new Date(departure.getTime() + 60_000));
    assert.equal(r.cancellable, false);
    assert.match(r.reason, /departed/i);
  });

  test("handles a missing departure time safely", () => {
    const r = calculateRefund({ ...booking, departure: undefined }, new Date());
    assert.equal(r.cancellable, false);
  });
});
