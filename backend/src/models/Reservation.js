const mongoose = require("mongoose");

const ReservationSchema = new mongoose.Schema({
  slot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BookingSlot",
    required: true,
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  status: {
    type: String,
    enum: ["booked", "cancelled", "pending"],
    default: "booked",
  },

  message: {
    type: String, // for "request meeting"
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Reservation", ReservationSchema);

//TODO: alot of stuff idk socs is annoying me