
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const SeatAvailability = require("../models/SeatAvailability");

dotenv.config();

const trains = [
  {
    id: "12657",
    number: "12657",
    classes: ["SL", "3A", "2A"]
  },
  {
    id: "12608",
    number: "12608",
    classes: ["CC", "2S"]
  }
];

// Sample seat counts for demo purposes.
const seatConfig = {
  SL: { totalSeats: 200, availableSeats: 150 },
  "3A": { totalSeats: 64, availableSeats: 42 },
  "2A": { totalSeats: 46, availableSeats: 28 },
  CC: { totalSeats: 78, availableSeats: 0 },
  "2S": { totalSeats: 100, availableSeats: 60 }
};

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

async function seedSeatAvailability() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from backend/.env");
  }

  // Usage:
  // node src/scripts/seedSeatAvailability.js [startDate] [numberOfDays]

  const startDate =
    process.argv[2] || new Date().toISOString().slice(0, 10);

  const numberOfDays = Number(process.argv[3] || 30);

  if (!isValidDate(startDate)) {
    throw new Error("Start date must be in YYYY-MM-DD format.");
  }

  if (!Number.isInteger(numberOfDays) || numberOfDays < 1 || numberOfDays > 90) {
    throw new Error("Number of days must be between 1 and 90.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  let insertedCount = 0;

  for (let day = 0; day < numberOfDays; day++) {
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + day);

    const journeyDate = date.toISOString().slice(0, 10);

    for (const train of trains) {
      for (const travelClass of train.classes) {
        const config = seatConfig[travelClass];

        const record = {
          trainId: train.id,
          trainNumber: train.number,
          journeyDate,
          travelClass,
          totalSeats: config.totalSeats,
          availableSeats: config.availableSeats
        };

        const result = await SeatAvailability.updateOne(
          {
            trainId: record.trainId,
            journeyDate: record.journeyDate,
            travelClass: record.travelClass
          },
          { $setOnInsert: record },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          insertedCount++;
        }
      }
    }
  }

  console.log(`Availability configured from ${startDate} for ${numberOfDays} days.`);
  console.log(`New availability records inserted: ${insertedCount}`);
  console.log("Existing availability records were preserved.");

  await mongoose.disconnect();
}

seedSeatAvailability().catch(async (error) => {
  console.error("Seeding failed:", error.message);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exitCode = 1;
});
