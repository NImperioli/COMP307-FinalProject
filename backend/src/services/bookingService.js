//Nicholas Imperioli - 261120345
const { createBooking, findBookings, updateBooking } = require("../models/bookingModel");

// TYPE 1 — Request a Meeting 
const requestMeeting = async (userId, ownerId, message, userEmail, ownerEmail) => {
  const booking = await createBooking({
    type:       "TYPE1",
    userId,
    ownerId,
    userEmail,
    ownerEmail,
    message,
    status:     "pending",
    createdAt:  new Date(),
  });

  const notifyOwner = `mailto:${ownerEmail}?subject=${encodeURIComponent(
    "New meeting request"
  )}&body=${encodeURIComponent(
    `Hi,\n\n${userEmail} has sent you a meeting request:\n\n"${message}"\n\nLog in to approve or decline it.`
  )}`;

  return { booking, notifyOwner };
};

const respondToRequest = async (bookingId, accepted) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const status = accepted ? "approved" : "declined";
  const result = await updateBooking(bookingId, { status, respondedAt: new Date() });

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });

  const notifyUser = `mailto:${booking.userEmail}?subject=${encodeURIComponent(
    `Your meeting request has been ${status}`
  )}&body=${encodeURIComponent(
    accepted
      ? `Hi,\n\nYour meeting request has been approved by ${booking.ownerEmail}.\n\nThe appointment now appears on your dashboard.`
      : `Hi,\n\nUnfortunately your meeting request was declined by ${booking.ownerEmail}.`
  )}`;

  return { result, notifyUser };
};

const getUserMeetingRequests = async (userId) =>
  await findBookings({ type: "TYPE1", userId });

const getOwnerMeetingRequests = async (ownerId) =>
  await findBookings({ type: "TYPE1", ownerId });

const getOwnerPendingRequests = async (ownerId) =>
  await findBookings({ type: "TYPE1", ownerId, status: "pending" });

// TYPE 2 — Group Meeting (Calendar Method)
const createGroupMeeting = async (ownerId, ownerEmail, title, slots, opensAt, closesAt) => {
  return await createBooking({
    type:      "TYPE2",
    ownerId,
    ownerEmail,
    title,
    slots: slots.map(s => ({
      time:   new Date(s),
      votes:  0,
      voters: [],   // userIds who selected this slot
    })),
    status:    "collecting_votes",
    opensAt:   new Date(opensAt),
    closesAt:  new Date(closesAt),
    createdAt: new Date(),
  });
};

const voteForSlots = async (bookingId, userId, slotTimes) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const results = [];
  for (const slotTime of slotTimes) {
    const time = new Date(slotTime);
    const result = await db.collection("bookings").updateOne(
      {
        _id: new ObjectId(bookingId),
        slots: {
          $elemMatch: {
            time: {
              $gte: new Date(time.getTime() - 1),
              $lte: new Date(time.getTime() + 1),
            },
            voters: { $ne: userId },
          },
        },
      },
      {
        $inc: { "slots.$.votes": 1 },
        $addToSet: { "slots.$.voters": userId },
      }
    );
    results.push({ slotTime, modified: result.modifiedCount === 1 });
  }
  return results;
};

const getSlotVoteCounts = async (bookingId) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");

  return booking.slots
    .map(s => ({ time: s.time, votes: s.votes, voters: s.voters }))
    .sort((a, b) => b.votes - a.votes);
};

const finalizeGroupMeeting = async (bookingId, selectedTime, repeatWeeks = 1, ownerEmail) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");

  const result = await updateBooking(bookingId, {
    status:       "approved",
    selectedTime: new Date(selectedTime),
    repeatWeeks,
    finalizedAt:  new Date(),
  });

  // Expand recurrence — one doc per week
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const base        = new Date(selectedTime);
  const allVoters   = [...new Set(booking.slots.flatMap(s => s.voters))];

  const appointments = Array.from({ length: repeatWeeks }, (_, w) => ({
    bookingId:    new ObjectId(bookingId),
    type:         "TYPE2",
    ownerId:      booking.ownerId,
    ownerEmail:   booking.ownerEmail,
    title:        booking.title,
    time:         new Date(base.getTime() + w * MS_PER_WEEK),
    weekNumber:   w + 1,
    isRecurring:  repeatWeeks > 1,
    participants: allVoters,   // all users who voted on any slot
    createdAt:    new Date(),
  }));

  if (appointments.length > 0) {
    await db.collection("appointments").insertMany(appointments);
  }

  const recurrenceNote = repeatWeeks > 1
    ? `This meeting repeats for ${repeatWeeks} consecutive weeks.`
    : `This is a one-time meeting.`;

  const notifyOwner = `mailto:${ownerEmail}?subject=${encodeURIComponent(
    `Group meeting finalized — "${booking.title}"`
  )}&body=${encodeURIComponent(
    `Hi,\n\nYou finalized the group meeting "${booking.title}".\n\nSelected time: ${base.toLocaleString()}\n\n${recurrenceNote}\n\n${appointments.length} appointment(s) created on both your and participants' dashboards.`
  )}`;

  return { result, appointments, notifyOwner };
};

const getUserAppointments = async (userId) => {
  const db = require("../config/db").getDB();
  const [type1, type2] = await Promise.all([
    db.collection("bookings").find({ type: "TYPE1", userId, status: "approved" }).toArray(),
    db.collection("appointments").find({ type: "TYPE2", participants: userId }).toArray(),
  ]);
  return { type1, type2 };
};

const getOwnerAppointments = async (ownerId) => {
  const db = require("../config/db").getDB();
  const [type1, type2] = await Promise.all([
    db.collection("bookings").find({ type: "TYPE1", ownerId, status: "approved" }).toArray(),
    db.collection("appointments").find({ type: "TYPE2", ownerId }).toArray(),
  ]);
  return { type1, type2 };
};

// TYPE 3 — Recurring Office Hours 
const createOfficeHours = async (ownerId, slots, weeks) => {
  return await createBooking({
    type:      "TYPE3",
    ownerId,
    slots:     slots.map(s => ({ time: s, reservedBy: null })),
    weeks,
    status:    "open",
    createdAt: new Date(),
  });
};

const reserveOfficeHour = async (bookingId, slotTime, userId) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();
  return await db.collection("bookings").updateOne(
    { _id: new ObjectId(bookingId), "slots.time": slotTime, "slots.reservedBy": null },
    { $set: { "slots.$.reservedBy": userId } }
  );
};

module.exports = {
  // Type 1
  requestMeeting,
  respondToRequest,
  getUserMeetingRequests,
  getOwnerMeetingRequests,
  getOwnerPendingRequests,
  // Type 2
  createGroupMeeting,
  voteForSlots,
  getSlotVoteCounts,
  finalizeGroupMeeting,
  getUserAppointments,
  getOwnerAppointments,
  // Type 3
  createOfficeHours,
  reserveOfficeHour,
};