const requireAuth = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const { confirmPayment } = require("../controllers/paymentController");

const {
  getBookingConfirmation,
  getBookingByPNR,
  cancelBooking
} = require("../controllers/bookingController");

// Authentication middleware will be attached before these handlers.

router.get("/pnr/:pnr", requireAuth, getBookingByPNR);
router.get("/:bookingId/confirmation", requireAuth, getBookingConfirmation);
router.post("/:bookingId/payment/confirm", requireAuth, confirmPayment);
router.post("/:bookingId/cancel", requireAuth, cancelBooking);

module.exports = router;