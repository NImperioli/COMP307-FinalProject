//Nicholas Imperioli - 261120345
require("dotenv").config();
const express = require("express");
const { connectDB } = require("./src/config/db"); 
const bookingRoutes = require("./src/routes/bookingRoutes");
const authRoutes = require("./src/routes/authRoutes"); // Annie Huynh

const app = express();
app.use(express.json());
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes); // Annie Huynh

connectDB(); 

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
