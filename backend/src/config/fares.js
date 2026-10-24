// Fare per passenger (INR) for each travel class.
// Sample data for the academic project; AC 3 Tier = Rs 850 matches the Test Plan (TC_05 / TC_07).
const FARES = {
  SL: 350,
  "3A": 850,
  "2A": 1200,
  CC: 600,
  "2S": 150,
};

// Seats are held for this long while the passenger completes payment (UC-04).
const HOLD_MINUTES = 10;

function getFarePerPassenger(travelClass) {
  return FARES[String(travelClass).toUpperCase()];
}

function calculateTotalFare(travelClass, passengerCount) {
  const fare = getFarePerPassenger(travelClass);
  if (fare === undefined) return undefined;
  return fare * passengerCount;
}

module.exports = { FARES, HOLD_MINUTES, getFarePerPassenger, calculateTotalFare };
