//Nicholas Imperioli - 261120345
require("dotenv").config();
const express = require("express");
const { connectDB } = require("./src/config/db"); 
const bookingRoutes = require("./src/routes/bookingRoutes");
const authRoutes = require("./src/routes/authRoutes"); // Annie Huynh
const slotRoutes = require("./src/routes/slotRoutes"); //Annie Huynh
const cors = require('cors'); //wb
const path = require("path");
const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://https://winter2026-comp307-group38.cs.mcgill.ca',
  allowedHeaders: ["Content-Type", "Authorization"]
})); // wb
// disable server-side cache, stop sending stale data
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/frontend", express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/landing.html"));
});

app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes); // Annie Huynh
app.use("/api/slots", slotRoutes); // Annie Huynh

connectDB(); 

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
