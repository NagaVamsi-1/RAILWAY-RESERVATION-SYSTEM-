// Shapes a booking for API responses: no internal fields, and payment data is masked.
function toPublicBooking(doc) {
  const booking = typeof doc.toObject === "function" ? doc.toObject() : doc;

  return {
    _id: booking._id,
    pnr: booking.pnr || null,
    status: booking.status,
    trainId: booking.trainId,
    trainNumber: booking.trainNumber,
    trainName: booking.trainName,
    source: booking.source,
    destination: booking.destination,
    journeyDate: booking.journeyDate,
    departure: booking.departure,
    travelClass: booking.travelClass,
    passengers: booking.passengers,
    seatCount: booking.seatCount,
    farePerPassenger: booking.farePerPassenger,
    totalAmount: booking.totalAmount,
    holdExpiresAt: booking.status === "PENDING_PAYMENT" ? booking.holdExpiresAt : undefined,
    payment: booking.payment && booking.payment.status
      ? {
          paymentId: booking.payment.paymentId,
          method: booking.payment.method,
          maskedReference: booking.payment.maskedReference,
          amount: booking.payment.amount,
          status: booking.payment.status,
          paidAt: booking.payment.paidAt,
        }
      : null,
    refund: booking.refund && booking.refund.status
      ? {
          refundId: booking.refund.refundId,
          status: booking.refund.status,
          percentage: booking.refund.percentage,
          amount: booking.refund.amount,
          deduction: booking.refund.deduction,
          processedAt: booking.refund.processedAt,
        }
      : null,
    cancelledAt: booking.cancelledAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

module.exports = { toPublicBooking };
