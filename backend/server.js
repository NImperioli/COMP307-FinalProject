require("dotenv").config();
const express = require("express");
const { connectDB } = require("./src/config/db"); 
const bookingRoutes = require("./src/routes/bookingRoutes");

const app = express();
app.use(express.json());
app.use("/api/bookings", bookingRoutes);

connectDB(); 

app.listen(5000, () => {
  console.log("Server running on port 5000");
});