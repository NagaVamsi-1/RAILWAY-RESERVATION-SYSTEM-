
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const SeatAvailability = require("./models/SeatAvailability");
const Booking = require("./models/Booking");
const bookingsRouter = require("./routes/bookings");
const { calculateTotalFare, getFarePerPassenger, HOLD_MINUTES } = require("./config/fares");
const { releaseExpiredHolds } = require("./services/holds");
const { toPublicBooking } = require("./services/publicBooking");
const { countWaitlistedSeats, promoteWaitlist } = require("./services/waitlist");
const { MAX_WAITLIST_SEATS } = require("./config/waitlist");
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require("./config/languages");
const waitlistRouter = require("./routes/waitlist");

const usersRouter = require("./routes/users");
const authenticateToken = require("./middleware/auth");
dotenv.config();

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

function isValidDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
}

function isJourneyDateInPast(date) {
  const journeyDate = new Date(`${date}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return journeyDate < today;
}

app.get("/", (req, res) => {
  res.send("Railway Reservation System API is running.");
});

// BL-07: Search trains
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

  if (!isValidDate(date)) {
    return res.status(400).json({
      message: "Please provide a valid journey date."
    });
  }

  if (source.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return res.status(400).json({
      message: "Source and destination must be different."
    });
  }

  if (isJourneyDateInPast(date)) {
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

// BL-09: Check seat availability
app.get("/api/seats/availability", async (req, res) => {
  const { trainId, date, travelClass } = req.query;

  if (
    typeof trainId !== "string" ||
    !trainId.trim() ||
    typeof date !== "string" ||
    !date.trim() ||
    typeof travelClass !== "string" ||
    !travelClass.trim()
  ) {
    return res.status(400).json({
      message: "Train ID, journey date and travel class are required."
    });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({
      message: "Please provide a valid journey date."
    });
  }

  try {
    await releaseExpiredHolds();

    const key = {
      trainId: trainId.trim(),
      journeyDate: date,
      travelClass: travelClass.trim().toUpperCase()
    };

    let availability = await SeatAvailability.findOne(key).lean();

    // BL-14: seats that are free go to the waitlist first, so never show them as available.
    if (availability && availability.availableSeats > 0) {
      if (await promoteWaitlist(key)) {
        availability = await SeatAvailability.findOne(key).lean();
      }
    }

    if (!availability) {
      return res.status(404).json({
        message:
          "Seat availability has not been configured for this train, date and class."
      });
    }

    const waitlistedSeats = await countWaitlistedSeats(key);

    return res.status(200).json({
      trainId: availability.trainId,
      trainNumber: availability.trainNumber,
      journeyDate: availability.journeyDate,
      travelClass: availability.travelClass,
      totalSeats: availability.totalSeats,
      availableSeats: availability.availableSeats,
      // BL-14: how much of the waitlist is already taken for this class.
      waitlistedSeats,
      waitlistSeatsRemaining: Math.max(0, MAX_WAITLIST_SEATS - waitlistedSeats)
    });
  } catch (error) {
    console.error("Seat availability lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve seat availability."
    });
  }
});

// BL-10 / BL-11: Create a booking. Seats are held and the booking stays
// PENDING_PAYMENT until payment succeeds (see routes/bookings.js).
app.post("/api/bookings", authenticateToken, async (req, res) => {
  const { trainId, journeyDate, travelClass, passengers } = req.body;
  // BL-14: only used as a fallback when the class cannot seat everyone.
  const wantsWaitlist = req.body.joinWaitlist === true;

  if (
    typeof trainId !== "string" ||
    !trainId.trim() ||
    typeof journeyDate !== "string" ||
    !journeyDate.trim() ||
    typeof travelClass !== "string" ||
    !travelClass.trim() ||
    !Array.isArray(passengers) ||
    passengers.length < 1 ||
    passengers.length > 6
  ) {
    return res.status(400).json({
      message:
        "Provide a train ID, journey date, travel class and 1–6 passengers."
    });
  }

  if (!isValidDate(journeyDate)) {
    return res.status(400).json({
      message: "Please provide a valid journey date."
    });
  }

  if (isJourneyDateInPast(journeyDate)) {
    return res.status(400).json({
      message: "Journey date cannot be in the past."
    });
  }

  for (const passenger of passengers) {
    if (
      !passenger ||
      typeof passenger.name !== "string" ||
      !passenger.name.trim() ||
      passenger.name.trim().length > 100 ||
      !Number.isInteger(passenger.age) ||
      passenger.age < 1 ||
      passenger.age > 120 ||
      !["Male", "Female", "Other"].includes(passenger.gender)
    ) {
      return res.status(400).json({
        message:
          "Each passenger needs a valid name, age and gender (Male, Female or Other)."
      });
    }
  }

  const train = trains.find((item) => item.id === trainId.trim());

  if (!train) {
    return res.status(404).json({
      message: "Train not found."
    });
  }

  const normalizedClass = travelClass.trim().toUpperCase();

  if (!train.classes.includes(normalizedClass)) {
    return res.status(400).json({
      message: "The selected class is not available on this train."
    });
  }

  let seatsReserved = false;

  // Creates the booking document. A waitlist booking (BL-14) is identical except that it
  // never holds seats and is flagged so payment puts it in the queue instead of confirming it.
  const createBookingRecord = (isWaitlist) =>
    Booking.create({
      userId: req.user.userId,
      trainId: train.id,
      trainNumber: train.number,
      trainName: train.name,
      source: train.source,
      destination: train.destination,
      journeyDate,
      travelClass: normalizedClass,
      passengers: passengers.map((passenger) => ({
        name: passenger.name.trim(),
        age: passenger.age,
        gender: passenger.gender
      })),
      seatCount: passengers.length,
      departure: train.departure,
      farePerPassenger: getFarePerPassenger(normalizedClass),
      totalAmount: calculateTotalFare(normalizedClass, passengers.length),
      status: "PENDING_PAYMENT",
      isWaitlist,
      holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000)
    });

  try {
    // Free seats held by unpaid bookings whose payment window has expired.
    await releaseExpiredHolds();

    // BL-14: passengers already waiting get any free seats before a new booking can take them.
    await promoteWaitlist({
      trainId: train.id,
      journeyDate,
      travelClass: normalizedClass
    });

    // Atomically decrement seats only if enough are available.
    const availability = await SeatAvailability.findOneAndUpdate(
      {
        trainId: train.id,
        journeyDate,
        travelClass: normalizedClass,
        availableSeats: { $gte: passengers.length }
      },
      {
        $inc: { availableSeats: -passengers.length }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!availability) {
      const existingAvailability = await SeatAvailability.findOne({
        trainId: train.id,
        journeyDate,
        travelClass: normalizedClass
      }).lean();

      if (!existingAvailability) {
        return res.status(404).json({
          message:
            "Seat availability has not been configured for this train, date and class."
        });
      }

      // BL-14: not enough seats. Offer the waitlist, or join it when the passenger asked to.
      const waitlistSeatsRemaining = Math.max(
        0,
        MAX_WAITLIST_SEATS -
          (await countWaitlistedSeats({
            trainId: train.id,
            journeyDate,
            travelClass: normalizedClass
          }))
      );
      const waitlistHasRoom = waitlistSeatsRemaining >= passengers.length;

      if (!wantsWaitlist) {
        return res.status(409).json({
          message: "Not enough seats are available for the requested passengers.",
          availableSeats: existingAvailability.availableSeats,
          canJoinWaitlist: waitlistHasRoom,
          waitlistSeatsRemaining
        });
      }

      if (!waitlistHasRoom) {
        return res.status(409).json({
          message: "The waitlist for this class is full.",
          availableSeats: existingAvailability.availableSeats,
          canJoinWaitlist: false,
          waitlistSeatsRemaining
        });
      }

      // No seats are held for a waitlist booking: it only needs payment to enter the queue.
      const waitlistBooking = await createBookingRecord(true);

      return res.status(201).json({
        message: `You are joining the waitlist. No seat is held. Pay within ${HOLD_MINUTES} minutes to get your waitlist PNR; the ticket is confirmed automatically if seats become available.`,
        booking: toPublicBooking(waitlistBooking)
      });
    }

    seatsReserved = true;

    const booking = await createBookingRecord(false);

    return res.status(201).json({
      message: `Seats held for ${HOLD_MINUTES} minutes. Complete the payment to confirm your booking.`,
      booking: toPublicBooking(booking)
    });
  } catch (error) {
    if (seatsReserved) {
      try {
        await SeatAvailability.updateOne(
          {
            trainId: train.id,
            journeyDate,
            travelClass: normalizedClass
          },
          {
            $inc: { availableSeats: passengers.length }
          }
        );
      } catch (rollbackError) {
        console.error("Seat rollback failed:", rollbackError.message);
      }
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Booking validation failed.",
        error: error.message
      });
    }

    console.error("Booking creation failed:", error.message);

    return res.status(500).json({
      message: "Unable to create booking."
    });
  }
});

// BL-10: Retrieve a booking
app.get("/api/bookings/:bookingId", async (req, res) => {
  const { bookingId } = req.params;

  if (!mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({
      message: "Invalid booking ID."
    });
  }

  try {
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found."
      });
    }

    return res.status(200).json({ booking: toPublicBooking(booking) });
  } catch (error) {
    console.error("Booking lookup failed:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve booking."
    });
  }
});

// BL-11 payment, BL-12 PNR lookup, BL-13 cancellation and refund
app.use("/api/bookings", bookingsRouter);
app.use("/api/users", usersRouter);

// BL-14: monitor waitlisted bookings
app.use("/api/waitlist", waitlistRouter);

// BL-15: languages the interface supports
app.get("/api/languages", (req, res) => {
  res.status(200).json({
    defaultLanguage: DEFAULT_LANGUAGE,
    languages: SUPPORTED_LANGUAGES
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
