const mongoose = require("mongoose");

const BookingSlotSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  title: {
    type: String, // e.g. "Office Hours"
  },

  startTime: {
    type: Date,
    required: true,
  },

  endTime: {
    type: Date,
    required: true,
  },

  isPublic: {
    type: Boolean,
    default: false, // private by default
  },

  isRecurring: {
    type: Boolean,
    default: false,
  },

  recurrenceCount: {
    type: Number, // e.g. 5 weeks
  },

  type: {
    type: String,
    enum: ["office_hours", "group", "request"],
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("BookingSlot", BookingSlotSchema);

//TODO: alot of stuff