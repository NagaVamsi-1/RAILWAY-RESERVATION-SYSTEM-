const test = require("node:test");
const assert = require("node:assert/strict");

const Booking = require("../models/Booking");
const { cancelBooking } = require("../controllers/bookingController");

const originalFindOneAndUpdate = Booking.findOneAndUpdate;
const originalFindOne = Booking.findOne;

function mockQuery(result) {
  return {
    select: async () => result
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

const validBookingId = "507f1f77bcf86cd799439011";

function makeRequest(overrides = {}) {
  return {
    params: { bookingId: validBookingId },
    user: { id: "user-123" },
    ...overrides
  };
}

test("confirmed paid booking can be cancelled", async (t) => {
  const cancelledBooking = {
    _id: validBookingId,
    pnr: "1234567890",
    status: "CANCELLED",
    paymentStatus: "PAID",
    refundAmount: null,
    refundStatus: "PENDING_POLICY",
    cancelledAt: new Date()
  };

  let receivedFilter;
  let receivedUpdate;

  Booking.findOneAndUpdate = (filter, update) => {
    receivedFilter = filter;
    receivedUpdate = update;
    return mockQuery(cancelledBooking);
  };

  Booking.findOne = originalFindOne;

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(makeRequest(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.booking.status, "CANCELLED");
  assert.equal(res.body.booking.refundStatus, "PENDING_POLICY");
  assert.equal(res.body.booking.refundAmount, null);
  assert.equal(receivedFilter.userId, "user-123");
  assert.equal(receivedFilter.status, "CONFIRMED");
  assert.equal(receivedFilter.paymentStatus, "PAID");
  assert.equal(receivedUpdate.$set.status, "CANCELLED");
});

test("invalid booking ID is rejected", async (t) => {
  Booking.findOneAndUpdate = () => {
    throw new Error("Database should not be queried");
  };

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(
    makeRequest({ params: { bookingId: "invalid-id" } }),
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid booking ID");
});

test("request without authenticated user is rejected", async (t) => {
  Booking.findOneAndUpdate = () => {
    throw new Error("Database should not be queried");
  };

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(makeRequest({ user: undefined }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Authentication is required");
});

test("already cancelled booking cannot be cancelled again", async (t) => {
  Booking.findOneAndUpdate = () => mockQuery(null);
  Booking.findOne = () => mockQuery({
    status: "CANCELLED",
    paymentStatus: "PAID"
  });

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(makeRequest(), res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, "Booking has already been cancelled");
});

test("unpaid or unconfirmed booking cannot be cancelled", async (t) => {
  Booking.findOneAndUpdate = () => mockQuery(null);
  Booking.findOne = () => mockQuery({
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING"
  });

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(makeRequest(), res);

  assert.equal(res.statusCode, 409);
  assert.equal(
    res.body.message,
    "Only confirmed, paid bookings can be cancelled"
  );
});

test("booking not owned by user is not found", async (t) => {
  Booking.findOneAndUpdate = () => mockQuery(null);
  Booking.findOne = () => mockQuery(null);

  t.after(() => {
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    Booking.findOne = originalFindOne;
  });

  const res = makeResponse();
  await cancelBooking(makeRequest(), res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Booking not found");
});
