// Refund rules (the SRS says "applicable rules" without defining them, so these are
// documented assumptions based on time left before departure).
const REFUND_TIERS = [
  { minHours: 48, percentage: 90 },
  { minHours: 12, percentage: 75 },
  { minHours: 4, percentage: 50 },
  { minHours: 0, percentage: 0 },
];

// Departure times are Indian Standard Time.
function getDepartureDate(journeyDate, departure) {
  return new Date(`${journeyDate}T${departure}:00+05:30`);
}

/**
 * Works out whether a booking can be cancelled and how much is refunded.
 * Pure function: no database access.
 */
function calculateRefund(booking, now = new Date()) {
  const departureAt = getDepartureDate(booking.journeyDate, booking.departure);
  const hoursBeforeDeparture = (departureAt.getTime() - now.getTime()) / 36e5;

  if (Number.isNaN(hoursBeforeDeparture)) {
    return { cancellable: false, reason: "Departure time is unavailable for this booking." };
  }

  if (hoursBeforeDeparture < 0) {
    return { cancellable: false, reason: "The train has already departed, so this ticket cannot be cancelled." };
  }

  const tier = REFUND_TIERS.find((item) => hoursBeforeDeparture >= item.minHours);
  const total = booking.totalAmount;
  const refundAmount = Math.round(total * tier.percentage) / 100;
  const deduction = Math.round((total - refundAmount) * 100) / 100;

  return {
    cancellable: true,
    hoursBeforeDeparture: Math.round(hoursBeforeDeparture * 10) / 10,
    percentage: tier.percentage,
    totalAmount: total,
    refundAmount,
    deduction,
  };
}

module.exports = { REFUND_TIERS, getDepartureDate, calculateRefund };
