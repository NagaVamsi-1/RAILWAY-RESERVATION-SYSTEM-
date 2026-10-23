
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const SeatAvailability = require("../models/SeatAvailability");

dotenv.config();

async function seedSeatAvailability() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from backend/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  const journeyDate = "2026-11-01";

  const records = [
    {
      trainId: "12657",
      trainNumber: "12657",
      journeyDate,
      travelClass: "SL",
      totalSeats: 200,
      availableSeats: 150
    },
    {
      trainId: "12657",
      trainNumber: "12657",
      journeyDate,
      travelClass: "3A",
      totalSeats: 64,
      availableSeats: 42
    },
    {
      trainId: "12657",
      trainNumber: "12657",
      journeyDate,
      travelClass: "2A",
      totalSeats: 46,
      availableSeats: 28
    }
  ];

  for (const record of records) {
    await SeatAvailability.updateOne(
      {
        trainId: record.trainId,
        journeyDate: record.journeyDate,
        travelClass: record.travelClass
      },
      { $setOnInsert: record },
      { upsert: true }
    );
  }

  console.log(`Sample availability configured for ${journeyDate}.`);
  await mongoose.disconnect();
}

seedSeatAvailability().catch(async (error) => {
  console.error("Seeding failed:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
