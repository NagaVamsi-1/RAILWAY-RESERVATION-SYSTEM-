require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

const trains = [
  {
    id: "12657",
    name: "Bengaluru Chennai Mail",
    number: "12657",
    source: "Bengaluru",
    destination: "Chennai",
    departure: "22:40",
    arrival: "04:35",
    duration: "5h 55m",
    classes: ["SL", "3A", "2A"]
  },
  {
    id: "12608",
    name: "Lalbagh Express",
    number: "12608",
    source: "Bengaluru",
    destination: "Chennai",
    departure: "06:30",
    arrival: "12:00",
    duration: "5h 30m",
    classes: ["CC", "2S"]
  }
];

app.get("/", (req, res) => {
  res.send("Railway Reservation System API is running.");
});

app.get("/api/trains/search", (req, res) => {
  const { source, destination, date } = req.query;

  if (
    typeof source !== "string" ||
    typeof destination !== "string" ||
    typeof date !== "string" ||
    !source.trim() ||
    !destination.trim() ||
    !date.trim()
  ) {
    return res.status(400).json({
      message: "Source, destination and date are required."
    });
  }

  if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return res.status(400).json({
      message: "Source and destination must be different."
    });
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(date)) {
    return res.status(400).json({
      message: "Please provide a valid journey date."
    });
  }

  const journeyDate = new Date(`${date}T00:00:00Z`);

  if (
    Number.isNaN(journeyDate.getTime()) ||
    journeyDate.toISOString().slice(0, 10) !== date
  ) {
    return res.status(400).json({
      message: "Please provide a valid journey date."
    });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (journeyDate < today) {
    return res.status(400).json({
      message: "Journey date cannot be in the past."
    });
  }

  const matchingTrains = trains.filter(
    (train) =>
      train.source.toLowerCase() === source.trim().toLowerCase() &&
      train.destination.toLowerCase() === destination.trim().toLowerCase()
  );

  return res.status(200).json({
    journeyDate: date,
    count: matchingTrains.length,
    trains: matchingTrains
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("MongoDB Atlas connected successfully.");

      app.listen(PORT, () => {
        console.log(
          `Railway Reservation System API running on port ${PORT}`
        );
      });
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      process.exit(1);
    });
}

module.exports = app;
