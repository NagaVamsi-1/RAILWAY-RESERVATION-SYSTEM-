const crypto = require("node:crypto");

const SUPPORTED_METHODS = ["UPI", "CARD"];

// Demo triggers for the simulated gateway (documented in README):
//   UPI ID ending in "@failbank"  -> declined
//   Card 4000 0000 0000 0002      -> declined
const DECLINED_CARD = "4000000000000002";

function luhnValid(number) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function isExpiryValid(expiry, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  // A card is valid through the last day of its expiry month.
  const endOfMonth = new Date(year, month, 1);
  return endOfMonth > now;
}

/**
 * Validates the payment details sent by the client (TC_05: invalid details are rejected).
 * Returns { valid: true, details } or { valid: false, message }.
 * `details` never contains the full card number, CVV or UPI ID beyond what we need.
 */
function validatePaymentDetails(body, now = new Date()) {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Payment details are required." };
  }

  const method = typeof body.method === "string" ? body.method.trim().toUpperCase() : "";

  if (!SUPPORTED_METHODS.includes(method)) {
    return {
      valid: false,
      message: `Payment method must be one of: ${SUPPORTED_METHODS.join(", ")}.`,
    };
  }

  if (method === "UPI") {
    const upiId = typeof body.upiId === "string" ? body.upiId.trim() : "";
    if (!/^[A-Za-z0-9._-]{2,50}@[A-Za-z]{2,20}$/.test(upiId)) {
      return {
        valid: false,
        message: "Enter a valid UPI ID, for example name@bank.",
      };
    }
    return { valid: true, details: { method, upiId } };
  }

  // CARD
  const cardNumber =
    typeof body.cardNumber === "string" ? body.cardNumber.replace(/[\s-]/g, "") : "";
  const cardHolder = typeof body.cardHolder === "string" ? body.cardHolder.trim() : "";
  const expiry = typeof body.expiry === "string" ? body.expiry.trim() : "";
  const cvv = typeof body.cvv === "string" ? body.cvv.trim() : "";

  if (!/^\d{16}$/.test(cardNumber) || !luhnValid(cardNumber)) {
    return { valid: false, message: "Enter a valid 16-digit card number." };
  }
  if (!cardHolder || cardHolder.length > 100) {
    return { valid: false, message: "Enter the name on the card." };
  }
  if (!isExpiryValid(expiry, now)) {
    return { valid: false, message: "Enter a valid, unexpired card expiry (MM/YY)." };
  }
  if (!/^\d{3}$/.test(cvv)) {
    return { valid: false, message: "Enter a valid 3-digit CVV." };
  }

  return { valid: true, details: { method, cardNumber, cardHolder, expiry, cvv } };
}

/**
 * Simulated payment gateway (the SRS lists the payment service as an external dependency).
 * Replace this function with a real gateway SDK call to go live.
 * Sensitive data is only used inside this function; only masked values are returned for storage.
 */
async function processPayment(details, amount) {
  const paymentId = `PAY${crypto.randomBytes(6).toString("hex").toUpperCase()}`;

  let declined = false;
  let maskedReference;

  if (details.method === "UPI") {
    declined = details.upiId.toLowerCase().endsWith("@failbank");
    const [user, handle] = details.upiId.split("@");
    maskedReference = `${user.slice(0, 2)}***@${handle}`;
  } else {
    declined = details.cardNumber === DECLINED_CARD;
    maskedReference = `**** **** **** ${details.cardNumber.slice(-4)}`;
  }

  if (declined) {
    return {
      success: false,
      paymentId,
      method: details.method,
      maskedReference,
      amount,
      reason: "Payment was declined by the bank. Please try another payment method.",
    };
  }

  return { success: true, paymentId, method: details.method, maskedReference, amount };
}

module.exports = { SUPPORTED_METHODS, luhnValid, isExpiryValid, validatePaymentDetails, processPayment };
