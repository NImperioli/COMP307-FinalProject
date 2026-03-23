const { createBooking, findBookings, updateBooking } = require("../models/bookingModel");

// TYPE 1 — Request Meeting
const requestMeeting = async (userId, ownerId, message) => {
  return await createBooking({
    type: "TYPE1",
    userId,
    ownerId,
    message,
    status: "pending",
    createdAt: new Date()
  });
};

const respondToRequest = async (bookingId, accepted) => {
  const status = accepted ? "approved" : "declined";

  return await updateBooking(bookingId, {
    status,
    approvedAt: new Date()
  });
};

// TYPE 2 — Group Meeting (Calendar Voting)
const createGroupSlots = async (ownerId, slots) => {
  return await createBooking({
    type: "TYPE2",
    ownerId,
    slots: slots.map(s => ({
      time: s,
      votes: 0,
      voters: []
    })),
    status: "collecting_votes",
    createdAt: new Date()
  });
};

const voteSlot = async (bookingId, userId, slotTime) => {
  const db = require("../config/db").getDB();

  return await db.collection("bookings").updateOne(
    { _id: require("mongodb").ObjectId(bookingId), "slots.time": slotTime },
    {
      $inc: { "slots.$.votes": 1 },
      $addToSet: { "slots.$.voters": userId }
    }
  );
};

const finalizeGroupMeeting = async (bookingId, selectedTime, repeatWeeks = 1) => {
  return await updateBooking(bookingId, {
    status: "approved",
    selectedTime,
    repeatWeeks
  });
};

// TYPE 3 — Recurring Office Hours
const createOfficeHours = async (ownerId, slots, weeks) => {
  return await createBooking({
    type: "TYPE3",
    ownerId,
    slots: slots.map(s => ({
      time: s,
      reservedBy: null
    })),
    weeks,
    status: "open",
    createdAt: new Date()
  });
};

const reserveOfficeHour = async (bookingId, slotTime, userId) => {
  const db = require("../config/db").getDB();

  return await db.collection("bookings").updateOne(
    {
      _id: require("mongodb").ObjectId(bookingId),
      "slots.time": slotTime,
      "slots.reservedBy": null
    },
    {
      $set: { "slots.$.reservedBy": userId }
    }
  );
};

module.exports = {
  requestMeeting,
  respondToRequest,
  createGroupSlots,
  voteSlot,
  finalizeGroupMeeting,
  createOfficeHours,
  reserveOfficeHour
};