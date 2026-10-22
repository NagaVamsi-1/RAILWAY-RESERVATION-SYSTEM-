
const test = require("node:test");
const assert = require("node:assert/strict");

const { verifyPayment } = require("../services/paymentService");

test("payment without a reference is rejected", async () => {
  const result = await verifyPayment("");

  assert.equal(result.verified, false);
  assert.equal(
    result.reason,
    "A valid payment reference is required"
  );
});

test("payment is not verified when no gateway is configured", async () => {
  const result = await verifyPayment("test-payment-reference");

  assert.equal(result.verified, false);
  assert.equal(
    result.reason,
    "Payment gateway integration is not configured"
  );
});
