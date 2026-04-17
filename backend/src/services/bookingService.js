//Nicholas Imperioli - 261120345
const { createBooking, findBookings, updateBooking } = require("../models/bookingModel");

// TYPE 1 — Request a Meeting 
const requestMeeting = async (userId, ownerId, message, userEmail, ownerEmail) => {
  if (userId.toString() === ownerId.toString()) {
    throw new Error("Cannot send a meeting request to yourself.");
  }

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

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "pending") {
    throw new Error(`Booking has already been ${booking.status} and cannot be updated.`);
  }

  const status = accepted ? "approved" : "declined";
  const result = await updateBooking(bookingId, { status, respondedAt: new Date() });

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

  const open  = new Date(opensAt);
  const close = new Date(closesAt);
  if (isNaN(open.getTime()))  throw new Error("opensAt is not a valid date.");
  if (isNaN(close.getTime())) throw new Error("closesAt is not a valid date.");
  if (close <= open)          throw new Error("closesAt must be after opensAt.");
  if (!Array.isArray(slots) || slots.length === 0) throw new Error("slots must be a non-empty array.");

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
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "collecting_votes") {
    throw new Error("Voting is no longer open for this booking.");
  }
  const now = new Date();

  const ops = slotTimes.map((slotTime) => {
    const time = new Date(slotTime);
    return {
      updateOne: {
        filter: {
          _id:    new ObjectId(bookingId),
          slots: {
            $elemMatch: {
              time: {
                $gte: new Date(time.getTime() - 1),
                $lte: new Date(time.getTime() + 1),
              },
              voters: { $ne: userId },   // atomic 
            },
          },
        },
        update: {
          $inc:      { "slots.$.votes": 1 },
          $addToSet: { "slots.$.voters": userId },
        },
      },
    };
  });

  if (ops.length === 0) return [];

  const bulkResult = await db.collection("bookings").bulkWrite(ops, { ordered: false });

  return slotTimes.map((slotTime, i) => ({
    slotTime,
    modified: bulkResult.modifiedCount > 0,
  }));
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
  if (booking.status !== "collecting_votes") {
    throw new Error("This group meeting has already been finalized or is in an unexpected state.");
  }

  // Integrity: selectedTime must be one of the proposed slots
  const selTime = new Date(selectedTime);
  const slotMatch = booking.slots.find(
    (s) => Math.abs(new Date(s.time).getTime() - selTime.getTime()) <= 1
  );
  if (!slotMatch) {
    throw new Error("selectedTime does not match any of the proposed slot times.");
  }
  const weeks = Number.isInteger(repeatWeeks) && repeatWeeks >= 1 ? repeatWeeks : 1;

  const result = await updateBooking(bookingId, {
    status:       "approved",
    selectedTime: selTime,
    repeatWeeks:  weeks,
    finalizedAt:  new Date(),
  });

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const base        = selTime;
  const allVoters   = [...new Set(booking.slots.flatMap((s) => s.voters))];

  const appointments = Array.from({ length: weeks }, (_, w) => ({
    bookingId:   new ObjectId(bookingId),
    type:        "TYPE2",
    ownerId:     booking.ownerId,
    ownerEmail:  booking.ownerEmail,
    title:       booking.title,
    time:        new Date(base.getTime() + w * MS_PER_WEEK),
    weekNumber:  w + 1,
    isRecurring: weeks > 1,
    participants: allVoters,
    createdAt:   new Date(),
  }));

  if (appointments.length > 0) {
    await db.collection("appointments").insertMany(appointments);
  }

  const recurrenceNote = weeks > 1
    ? `This meeting repeats for ${weeks} consecutive weeks.`
    : "This is a one-time meeting.";

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