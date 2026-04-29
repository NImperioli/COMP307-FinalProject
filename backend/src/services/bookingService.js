//Nicholas Imperioli - 261120345
const { createBooking, findBookings, updateBooking } = require("../models/bookingModel");
const { ObjectId } = require("mongodb");

const toOid = (val) => {
  try { return new ObjectId(val); } catch { return val; }
};

// TYPE 1 — Request a Meeting 
const requestMeeting = async (
  userId,
  ownerId,
  message,
  userEmail,
  ownerEmail,
  proposedTime
) => {

  if (userId.toString() === ownerId.toString()) {
    throw new Error("Cannot send a meeting request to yourself.");
  }

  const booking = await createBooking({
    type: "TYPE1",
    userId: toOid(userId),
    ownerId: toOid(ownerId),
    userEmail,
    ownerEmail,
    message,

    proposedTime: proposedTime ? new Date(proposedTime) : null,

    status: "pending",
    createdAt: new Date(),
  });

  const notifyOwner = `mailto:${ownerEmail}?subject=${encodeURIComponent(
    "New meeting request"
  )}&body=${encodeURIComponent(
    `Hi,\n\n${userEmail} has sent you a meeting request:\n\n"${message}"\n\nLog in to approve or decline it.`
  )}`;

  return { booking, notifyOwner };
};

const buildMeetingTime = (proposedTime) => {
  if (!proposedTime) {
    throw new Error("proposedTime is required.");
  }

  const start = new Date(proposedTime);
  if (isNaN(start.getTime())) {
    throw new Error("Invalid proposedTime.");
  }

  const end = new Date(start.getTime() + 30 * 60000);

  return { start, end };
};

const respondToRequest = async (bookingId, accepted, ownerId = null) => {
  const db = require("../config/db").getDB();

  let bookingOid;
  try { bookingOid = new ObjectId(bookingId); }
  catch { throw new Error("Invalid bookingId format."); }
  const booking = await db.collection("bookings").findOne({ _id: bookingOid });

  if (!booking) throw new Error("Booking not found.");
  if (ownerId !== null && booking.ownerId.toString() !== ownerId.toString()) {
    return {
      result: { matchedCount: 0, modifiedCount: 0 },
      notifyUser: null
    };
  }
  if (booking.status !== "pending") {
    throw new Error(`Booking has already been ${booking.status} and cannot be updated.`);
  }

  const status = accepted ? "approved" : "declined";
  const result = await updateBooking(booking._id, { status, respondedAt: new Date() });

  if (accepted && booking.proposedTime) {
    const { start, end } = buildMeetingTime(booking.proposedTime);

    await db.collection("slots").insertOne({
      ownerId: booking.ownerId,
      bookedBy: booking.userId,
      title: `Meeting with ${booking.userEmail}`,

      type: "booked",
      status: "active",

      inviteToken: booking._id.toString(),
      bookingId: booking._id,

      startTime: start,
      endTime: end,

      createdAt: new Date(),
    });
  }

  const notifyUser = `mailto:${booking.userEmail}?subject=${encodeURIComponent(
  `Your meeting request has been ${status}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nYour meeting request has been ${status.toUpperCase()} by ${booking.ownerEmail}.\n\nPlease check your dashboard for details.`
  )}`; 
  
return { result, notifyUser };
};

const getUserMeetingRequests = async (userId) =>
  await findBookings({ type: "TYPE1", userId: toOid(userId) });

const getOwnerMeetingRequests = async (ownerId) =>
  await findBookings({ type: "TYPE1", ownerId: toOid(ownerId) });

const getOwnerPendingRequests = async (ownerId) =>
  await findBookings({ type: "TYPE1", ownerId: toOid(ownerId), status: "pending" });

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
    ownerId:   toOid(ownerId),
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

const voteForSlots = async (bookingId, userId, slotTimes) => {  // FIXED: removed unused ownerId param
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");

  const now = new Date();

  // FIXED: enforce voting window
  if (now < new Date(booking.opensAt))  throw new Error("Voting has not opened yet.");
  if (now > new Date(booking.closesAt)) throw new Error("Voting has closed.");

  if (booking.status !== "collecting_votes") {
    return slotTimes.map(slotTime => ({ slotTime, modified: false }));
  }

  const ops = slotTimes.map((slotTime) => {
    const time = new Date(slotTime);
    return {
      updateOne: {
        filter: {
          _id: new ObjectId(bookingId),
          slots: {
            $elemMatch: {
              time: {
                $gte: new Date(time.getTime() - 1000),
                $lte: new Date(time.getTime() + 1000),
              },
              voters: { $ne: toOid(userId) },
            },
          },
        },
        update: {
          $inc:      { "slots.$.votes": 1 },
          $addToSet: { "slots.$.voters": toOid(userId) },
        },
      },
    };
  });

  if (ops.length === 0) return [];
  const bulkResult = await db.collection("bookings").bulkWrite(ops, { ordered: false });
  return slotTimes.map((slotTime) => ({ slotTime, modified: bulkResult.modifiedCount > 0 }));
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

const finalizeGroupMeeting = async (bookingId, selectedTime, repeatWeeks = 1, ownerEmail, ownerId) => { // FIXED: added ownerId param
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found.");

  // FIXED: ownership verification
  if (booking.ownerId.toString() !== ownerId.toString()) {
    throw new Error("You are not authorized to finalize this meeting.");
  }

  if (booking.status !== "collecting_votes") {
    throw new Error("This group meeting has already been finalized or is in an unexpected state.");
  }

  const selTime = new Date(selectedTime);
  const slotMatch = booking.slots.find(
    (s) => Math.abs(new Date(s.time).getTime() - selTime.getTime()) <= 1000
  );
  if (!slotMatch) throw new Error("selectedTime does not match any of the proposed slot times.");

  const weeks = Number.isInteger(repeatWeeks) && repeatWeeks >= 1 ? repeatWeeks : 1;

  const result = await updateBooking(bookingId, {
    status:       "approved",
    selectedTime: selTime,
    repeatWeeks:  weeks,
    finalizedAt:  new Date(),
  });

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const base = selTime;
  const allVoters = [...new Set(slotMatch.voters.map(v => v.toString()))].map(v => {
    try { return new ObjectId(v); } catch { return v; }
  });

  const appointments = Array.from({ length: weeks }, (_, w) => ({
    bookingId:    new ObjectId(bookingId),
    type:         "TYPE2",
    ownerId:      booking.ownerId,
    ownerEmail:   booking.ownerEmail,
    title:        booking.title,
    time:         new Date(base.getTime() + w * MS_PER_WEEK),
    weekNumber:   w + 1,
    isRecurring:  weeks > 1,
    participants: allVoters,
    createdAt:    new Date(),
  }));

  if (appointments.length > 0) {
    await db.collection("appointments").insertMany(appointments);
  }

  const recurrenceNote = weeks > 1
    ? `This meeting repeats for ${weeks} consecutive weeks.`
    : "This is a one-time meeting.";

  const participantDocs = await db.collection("users")
    .find({ _id: { $in: allVoters } })
    .project({ email: 1 })
    .toArray();

  const notifyParticipants = participantDocs.map(p =>
    `mailto:${p.email}?subject=${encodeURIComponent(
      `Group meeting confirmed — "${booking.title}"`
    )}&body=${encodeURIComponent(
      `Hi,\n\nThe group meeting "${booking.title}" has been scheduled for ${base.toLocaleString()}.\n\n${recurrenceNote}`
    )}`
  );

  const notifyOwner = `mailto:${booking.ownerEmail}?subject=${encodeURIComponent(
  `Group meeting confirmed — "${booking.title}"`
  )}&body=${encodeURIComponent(
    `Hi,\n\nYour group meeting "${booking.title}" has been finalized.\n\nTime: ${base.toLocaleString()}\n\n${recurrenceNote}`
  )}`;

  return {
  result,
  appointments,
  notifyParticipants,
  notifyOwner
  };
};

const getOpenGroupBookings = async (ownerId) => {
  const db = require("../config/db").getDB();

  return await db.collection("bookings")
    .find({
      type: "TYPE2",
      ownerId: toOid(ownerId),
      status: "collecting_votes"
    })
    .toArray();
};

// TYPE 3 — Recurring Office Hours 
const createOfficeHours = async (ownerId, slots, weeks) => {
  return await createBooking({
    type:      "TYPE3",
    ownerId:   toOid(ownerId),
    slots:     slots.map(s => ({ time: new Date(s), reservedBy: null })),
    weeks,
    status:    "open",
    createdAt: new Date(),
  });
};

const reserveOfficeHour = async (bookingId, slotTime, userId) => {
  const { ObjectId } = require("mongodb");
  const db = require("../config/db").getDB();

  const result = await db.collection("bookings").updateOne(
    {
      _id: new ObjectId(bookingId),
      slots: { $elemMatch: { time: new Date(slotTime), reservedBy: null } }
    },
    { $set: { "slots.$.reservedBy": toOid(userId) } }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Slot not found, already reserved, or not available.");
  }

  // Fetch booking and user to build notification
  const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
  const [owner, user] = await Promise.all([
    db.collection("users").findOne({ _id: booking.ownerId }),
    db.collection("users").findOne({ _id: toOid(userId) }),
  ]);

  const notifyOwner = `mailto:${owner.email}?subject=${encodeURIComponent(
    "Office hour reserved"
  )}&body=${encodeURIComponent(
    `Hi,\n\n${user.email} has reserved your office hour slot on ${new Date(slotTime).toLocaleString()}.\n\nThis appears on both your dashboards.`
  )}`;

  return { result, notifyOwner };
};
const getUserAppointments = async (userId) => {
  const db = require("../config/db").getDB();
  const { ObjectId } = require("mongodb");

  const [type1, type2, type3] = await Promise.all([
    db.collection("bookings")
      .find({ type: "TYPE1", userId: toOid(userId), status: "approved" })
      .toArray(),

    db.collection("appointments")
      .find({ type: "TYPE2", participants: toOid(userId) })
      .toArray(),

    db.collection("bookings").aggregate([
      {
        $match: {
          type: "TYPE3",
          "slots.reservedBy": toOid(userId)
        }
      },
      {
        $project: {
          ownerId: 1,
          weeks: 1,
          status: 1,
          slots: {
            $filter: {
              input: "$slots",
              as: "s",
              cond: {
                $eq: ["$$s.reservedBy", toOid(userId)]
              }
            }
          }
        }
      }
    ]).toArray(),
  ]);

  return { type1, type2, type3 };
};

const getOwnerAppointments = async (ownerId) => {
  const db = require("../config/db").getDB();
  const [type1, type2, type3] = await Promise.all([
    db.collection("bookings")
      .find({ type: "TYPE1", ownerId: toOid(ownerId), status: "approved" }).toArray(),
    db.collection("appointments").aggregate([
    { $match: { type: "TYPE2", ownerId: toOid(ownerId) } },
    { $lookup: { from: "users", localField: "participants", foreignField: "_id", as: "participantDocs" } }
    ]).toArray(),
    // TYPE3: all office-hour bookings owned by this owner
    db.collection("bookings")
      .find({ type: "TYPE3", ownerId: toOid(ownerId) }).toArray(),
  ]);
  return { type1, type2, type3 };
};

const cancelAnyBooking = async (bookingId, userId, type) => {
  const db = require("../config/db").getDB();
  const { ObjectId } = require("mongodb");

  if (!ObjectId.isValid(bookingId)) throw new Error("Invalid bookingId");
  const oid = new ObjectId(bookingId);

  if (type === "TYPE1") {
    const booking = await db.collection("bookings").findOne({ _id: oid });
    if (!booking) throw new Error("Not found");

    const isOwner = booking.ownerId.toString() === userId;
    const isUser = booking.userId.toString() === userId;
    if (!isOwner && !isUser) throw new Error("Not authorized");

    await db.collection("slots").deleteMany({ bookingId: oid });
    await db.collection("bookings").deleteOne({ _id: oid });

    const notify = [
      `mailto:${booking.userEmail}?subject=Meeting Cancelled&body=Your meeting was cancelled.`,
      `mailto:${booking.ownerEmail}?subject=Meeting Cancelled&body=The meeting was cancelled.`
    ];

    return { success: true, notify };
  }

  if (type === "TYPE2") {
    const appt = await db.collection("appointments").findOne({ _id: oid });
    if (!appt) throw new Error("Not found");

    const isOwner = appt.ownerId.toString() === userId;
    const isParticipant = appt.participants?.some(p => p.toString() === userId);

    if (!isOwner && !isParticipant) throw new Error("Not authorized");

    if (isOwner) {
      await db.collection("appointments").deleteOne({ _id: oid });

      const users = await db.collection("users")
        .find({ _id: { $in: appt.participants } })
        .project({ email: 1 })
        .toArray();

      const notify = users.map(u =>
        `mailto:${u.email}?subject=Group Meeting Cancelled&body=The meeting "${appt.title}" was cancelled.`
      );

      return { success: true, notify };
    } else {
      await db.collection("appointments").updateOne(
        { _id: oid },
        { $pull: { participants: new ObjectId(userId) } }
      );

      return { success: true };
    }
  }

  if (type === "TYPE3") {
    const booking = await db.collection("bookings").findOne({ _id: oid });
    if (!booking) throw new Error("Not found");

    const isOwner = booking.ownerId.toString() === userId;
    if (!isOwner) throw new Error("Not authorized");

    await db.collection("bookings").deleteOne({ _id: oid });

    return {
      success: true,
      notify: [`mailto:${booking.ownerEmail}?subject=Office Hours Cancelled`]
    };
  }

  throw new Error("Invalid type");
};
const completeGroupMeeting = async (appointmentId, userId) => {
  const db = require("../config/db").getDB();
  const { ObjectId } = require("mongodb");

  const appt = await db.collection("appointments").findOne({ _id: new ObjectId(appointmentId) });
  if (!appt) throw new Error("Appointment not found");

  const isOwner = appt.ownerId.toString() === userId;
  const isParticipant = appt.participants?.some(p => p.toString() === userId);

  if (!isOwner && !isParticipant) {
    throw new Error("Not authorized");
  }

  const field = isOwner ? "ownerCompleted" : "participantsCompleted";

  await db.collection("appointments").updateOne(
    { _id: new ObjectId(appointmentId) },
    isOwner
      ? { $set: { ownerCompleted: true } }
      : { $addToSet: { participantsCompleted: new ObjectId(userId) } }
  );

  const updated = await db.collection("appointments").findOne({ _id: new ObjectId(appointmentId) });

  const allParticipantsDone =
    updated.participants.every(p =>
      updated.participantsCompleted?.some(pc => pc.toString() === p.toString())
    );

  if (updated.ownerCompleted && allParticipantsDone) {
    await db.collection("appointments").updateOne(
      { _id: updated._id },
      { $set: { status: "completed", completedAt: new Date() } }
    );
  }

  return { success: true };
};

const completeMeeting = async (appointmentId, userId) => {
  const db = require("../config/db").getDB();
  const { ObjectId } = require("mongodb");

  const oid = new ObjectId(appointmentId);

  const appt = await db.collection("appointments").findOne({ _id: oid });
  if (!appt) throw new Error("Not found");

  const isOwner = appt.ownerId.toString() === userId;
  const isParticipant = appt.participants?.some(p => p.toString() === userId);

  if (!isOwner && !isParticipant) {
    throw new Error("Not authorized");
  }

  await db.collection("appointments").updateOne(
    { _id: oid },
    {
      $set: {
        status: "completed",
        completedAt: new Date()
      }
    }
  );

  return { success: true };
};

const completeAnyBooking = async (bookingId, userId) => {
  const db = require("../config/db").getDB();
  const { ObjectId } = require("mongodb");

  const oid = new ObjectId(bookingId);
  const booking = await db.collection("bookings").findOne({ _id: oid });

  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "approved") throw new Error("Only approved bookings can be completed");

  const result = await updateBooking(oid, { status: "completed", completedAt: new Date() });
  return { success: true, result };
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
  getOpenGroupBookings,
  getUserAppointments,
  getOwnerAppointments,
  // Type 3
  createOfficeHours,
  reserveOfficeHour,
  cancelAnyBooking,
  completeGroupMeeting,
  completeMeeting,
  completeAnyBooking,
};