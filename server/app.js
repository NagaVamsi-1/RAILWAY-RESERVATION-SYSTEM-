const express = require("express");
const cors = require("cors");

const bookingRoutes = require("./routes/bookingRoutes");
const trainRoutes = require("./routes/trainRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/trains", trainRoutes);
app.use("/api/bookings", bookingRoutes);

module.exports = app;