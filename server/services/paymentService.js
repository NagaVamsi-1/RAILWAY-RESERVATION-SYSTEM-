
/**
 * Development-only payment service.
 *
 * This deliberately does not claim that a real payment occurred.
 * Replace it with a verified payment-gateway integration before
 * using this application with real money.
 */
async function verifyPayment(paymentReference) {
    if (
      typeof paymentReference !== "string" ||
      paymentReference.trim().length === 0
    ) {
      return {
        verified: false,
        reason: "A valid payment reference is required"
      };
    }
  
    // No payment provider is connected yet, so no payment can
    // legitimately be marked as verified.
    return {
      verified: false,
      reason: "Payment gateway integration is not configured"
    };
  }
  
  module.exports = { verifyPayment };
  