const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const {
  luhnValid,
  isExpiryValid,
  validatePaymentDetails,
  processPayment,
} = require("../src/services/payment");
const { generatePnr, isValidPnrFormat } = require("../src/services/pnr");
const { calculateTotalFare } = require("../src/config/fares");

const validCard = {
  method: "CARD",
  cardNumber: "4242 4242 4242 4242",
  cardHolder: "Ravi Kumar",
  expiry: "12/35",
  cvv: "123",
};

describe("BL-11: payment validation (TC_05)", () => {
  test("accepts a valid UPI ID", () => {
    const result = validatePaymentDetails({ method: "UPI", upiId: "ravi@okbank" });
    assert.equal(result.valid, true);
  });

  test("rejects an invalid UPI ID format", () => {
    const result = validatePaymentDetails({ method: "UPI", upiId: "invalid_format" });
    assert.equal(result.valid, false);
    assert.match(result.message, /UPI/i);
  });

  test("rejects an unsupported payment method", () => {
    const result = validatePaymentDetails({ method: "CASH" });
    assert.equal(result.valid, false);
  });

  test("accepts a valid card and strips spaces", () => {
    const result = validatePaymentDetails(validCard);
    assert.equal(result.valid, true);
    assert.equal(result.details.cardNumber, "4242424242424242");
  });

  test("rejects a card that fails the Luhn check", () => {
    const result = validatePaymentDetails({ ...validCard, cardNumber: "4242424242424241" });
    assert.equal(result.valid, false);
  });

  test("rejects an expired card", () => {
    const result = validatePaymentDetails({ ...validCard, expiry: "01/20" });
    assert.equal(result.valid, false);
    assert.match(result.message, /expir/i);
  });

  test("rejects a bad CVV", () => {
    const result = validatePaymentDetails({ ...validCard, cvv: "12" });
    assert.equal(result.valid, false);
  });

  test("luhn and expiry helpers", () => {
    assert.equal(luhnValid("4242424242424242"), true);
    assert.equal(luhnValid("4000000000000002"), true);
    assert.equal(isExpiryValid("13/30"), false);
    assert.equal(isExpiryValid("06/30", new Date("2030-06-15")), true);
    assert.equal(isExpiryValid("06/30", new Date("2030-07-01")), false);
  });
});

describe("BL-11: simulated gateway", () => {
  test("approves a normal UPI payment and masks the reference", async () => {
    const { details } = validatePaymentDetails({ method: "UPI", upiId: "ravi@okbank" });
    const result = await processPayment(details, 850);
    assert.equal(result.success, true);
    assert.match(result.paymentId, /^PAY[0-9A-F]{12}$/);
    assert.equal(result.maskedReference, "ra***@okbank");
  });

  test("declines the demo failure UPI handle", async () => {
    const { details } = validatePaymentDetails({ method: "UPI", upiId: "ravi@failbank" });
    const result = await processPayment(details, 850);
    assert.equal(result.success, false);
  });

  test("declines the demo failure card and never returns the full number", async () => {
    const { details } = validatePaymentDetails({ ...validCard, cardNumber: "4000000000000002" });
    const result = await processPayment(details, 850);
    assert.equal(result.success, false);
    assert.equal(result.maskedReference, "**** **** **** 0002");
    assert.ok(!JSON.stringify(result).includes("4000000000000002"));
  });
});

describe("BL-12: PNR and fares", () => {
  test("generates 10-digit PNRs", () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(isValidPnrFormat(generatePnr()));
    }
  });

  test("rejects malformed PNRs", () => {
    assert.equal(isValidPnrFormat("12345"), false);
    assert.equal(isValidPnrFormat("0123456789"), false);
    assert.equal(isValidPnrFormat("abcdefghij"), false);
    assert.equal(isValidPnrFormat(undefined), false);
  });

  test("AC 3 Tier fare is Rs 850 per passenger (matches Test Plan)", () => {
    assert.equal(calculateTotalFare("3A", 1), 850);
    assert.equal(calculateTotalFare("3A", 3), 2550);
    assert.equal(calculateTotalFare("XX", 1), undefined);
  });
});
