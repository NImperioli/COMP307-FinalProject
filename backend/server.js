//Nicholas Imperioli - 261120345
require("dotenv").config();
const express = require("express");
const path = require("path");
const { connectDB } = require("./src/config/db");
const bookingRoutes = require("./src/routes/bookingRoutes");
const authRoutes = require("./src/routes/authRoutes");
const slotRoutes = require("./src/routes/slotRoutes");
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.set("trust proxy", 1);
app.use(cors({
  origin: ['http://winter2026-comp307-group38.cs.mcgill.ca',
           'https://winter2026-comp307-group38.cs.mcgill.ca'],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// disable server-side cache
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/frontend", express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/landing.html"));
});

app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/slots", slotRoutes);
// FIX: was /api/calendar — frontend calls /api/ical/...
app.use("/api/ical", require("./src/routes/calendarRoutes"));

connectDB();

app.listen(3000, () => {
  console.log("Server running on port 3000");
});