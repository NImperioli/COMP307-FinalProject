// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const COLLECTION = "reservations";

// Helper
const toOid = (val, label = "id") => {
  try {
    return new ObjectId(val);
  } catch {
    throw new Error(`Invalid ${label}: "${val}"`);
  }
};

const reserveSlot = async (slotId, userId) => {
  const db = getDB();

  const slot = await db.collection("slots").findOne({ _id: toOid(slotId, "slotId") });
  if (!slot) throw new Error("Slot not found.");
  
  // Integrity
  if (slot.ownerId.toString() === userId.toString()) {
    throw new Error("Owners cannot reserve their own booking slots.");
  }

  if (slot.status !== "active") throw new Error("Slot is not available for booking.");

  if (new Date(slot.startTime) < new Date()) {
    throw new Error("Cannot reserve a slot that has already started or passed.");
  }

  if (slot.type !== 'recurring') {
    const existing = await db.collection(COLLECTION).findOne({
    slotId: toOid(slotId, "slotId"),
    cancelledAt: { $exists: false },
  });
  if (existing) {
    if (existing.userId.toString() === userId.toString()) {
      throw new Error("You have already reserved this slot.");
    }
    throw new Error("This slot has already been reserved by another student.");
  }} else {
    const userAlreadyBooked = await db.collection(COLLECTION).findOne({
        slotId: toOid(slotId, "slotId"),
        userId: toOid(userId, "userId"),
        cancelledAt: { $exists: false },
    });
    if (userAlreadyBooked) throw new Error("You have already reserved this slot.");
  }

  return await db.collection(COLLECTION).insertOne({
    slotId: toOid(slotId, "slotId"),
    userId: toOid(userId, "userId"),
    reservedAt: new Date(),
  });
};

const cancelReservation = async (reservationId, userId) => {
  const db = getDB();

  const reservation = await db.collection("reservations").findOne({
    _id: toOid(reservationId, "reservationId")
  });

  if (!reservation) throw new Error("Reservation not found.");

  const slot = await db.collection("slots").findOne({
    _id: reservation.slotId
  });

  if (!slot) throw new Error("Slot not found.");

  const isOwner = slot.ownerId.toString() === userId;
  const isBooker = reservation.userId.toString() === userId;

  if (!isOwner && !isBooker) {
    throw new Error("Not authorized to cancel this reservation.");
  }

  if (reservation.cancelledAt) {
    throw new Error("Already cancelled.");
  }

  await db.collection("reservations").updateOne(
    { _id: reservation._id },
    {
      $set: {
        cancelledAt: new Date(),
        status: "cancelled"
      }
    }
  );

  // OPTIONAL: notify
  const user = await db.collection("users").findOne({ _id: reservation.userId });

  let notifyOwner = null;
  if (slot.ownerEmail && user) {
    notifyOwner = `mailto:${slot.ownerEmail}?subject=Booking Cancelled&body=${encodeURIComponent(
      `${user.email} cancelled a booking on ${new Date(slot.startTime).toLocaleString()}`
    )}`;
  }

  return { success: true, notifyOwner };
};

// Who booked a slot (owners view)
const findReservationBySlot = async (slotId) => {
  const db = getDB();
  const [result] = await db.collection(COLLECTION).aggregate([
    { $match: { slotId: toOid(slotId, "slotId"), cancelledAt: { $exists: false } } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" }
  ]).toArray();
  return result ?? null;
};

// Notificaiton helper
const findReservationWithDetails = async (reservationId) => {
  const db = getDB();
  const [result] = await db.collection(COLLECTION).aggregate([
    { $match: { _id: toOid(reservationId, "reservationId") } },
    { $lookup: { from: "slots", localField: "slotId",  foreignField: "_id", as: "slot"  } },
    { $lookup: { from: "users", localField: "userId",  foreignField: "_id", as: "user"  } },
    { $unwind: "$slot" },
    { $unwind: "$user" },
    { $limit: 1 },
  ]).toArray();
  return result ?? null;
};

// Owner view
const findReservationsByOwner = async (ownerId, { limit = 50, skip = 0 } = {}) => {
  const db = getDB();
  // FIXED: filter slots by ownerId in the lookup pipeline before the full scan
  return await db.collection("slots").aggregate([
    { $match: { ownerId: toOid(ownerId, "ownerId") } },  // start from slots, not reservations
    {
      $lookup: {
        from:         "reservations",
        localField:   "_id",
        foreignField: "slotId",
        as:           "reservation",
        pipeline: [{ $match: { cancelledAt: { $exists: false } } }],
      },
    },
    { $unwind: "$reservation" },
    {
      $lookup: {
        from:         "users",
        localField:   "reservation.userId",
        foreignField: "_id",
        as:           "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id:          "$reservation._id",
        slotId:       "$_id",
        slot:         "$$ROOT",
        user:         1,
        reservedAt:   "$reservation.reservedAt",
        status:       "$reservation.status",
        cancelledAt:  "$reservation.cancelledAt",
        completedAt:  "$reservation.completedAt",
      },
    },
    { $sort:  { startTime: 1 } },
    { $skip:  skip },
    { $limit: limit },
  ]).toArray();
};

// User view 
const findReservationsByUser = async (userId, { limit = 50, skip = 0 } = {}) => {
  const db = getDB();
  return await db.collection(COLLECTION).aggregate([
    {
      $match: {
        userId:      toOid(userId, "userId"),
        cancelledAt: { $exists: false },
      },
    },
    {
      $lookup: {
        from:         "slots",
        localField:   "slotId",
        foreignField: "_id",
        as:           "slot",
      },
    },
    { $match: { "slot.0": { $exists: true } } },
    { $unwind: "$slot" },
    {
      $lookup: {
        from:         "users",
        localField:   "slot.ownerId",
        foreignField: "_id",
        as:           "owner",
      },
    },
    { $unwind: "$owner" },
    { $sort: { "slot.startTime": 1 } },
    { $skip: skip },
    { $limit: limit },
  ]).toArray();
};

const findActiveReservationsBySlotIds = async (slotIds) => {
  if (!slotIds || slotIds.length === 0) return new Map();
  const db = getDB();

  const oids = slotIds.map((id) => (id instanceof ObjectId ? id : toOid(id, "slotId")));

  const results = await db.collection(COLLECTION).aggregate([
    {
      $match: {
        slotId:      { $in: oids },
        cancelledAt: { $exists: false },
      },
    },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
  ]).toArray();

  return new Map(results.map((r) => [r.slotId.toString(), r]));
};

module.exports = {
  reserveSlot,
  cancelReservation,
  findReservationBySlot,
  findReservationsByOwner,
  findReservationsByUser,
  findReservationWithDetails,
  findActiveReservationsBySlotIds,
};