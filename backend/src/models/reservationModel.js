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

  const existing = await db.collection(COLLECTION).findOne({
    slotId: toOid(slotId, "slotId"),
    cancelledAt: { $exists: false },
  });
  if (existing) throw new Error("Slot is already reserved.");

  return await db.collection(COLLECTION).insertOne({
    slotId: toOid(slotId, "slotId"),
    userId: toOid(userId, "userId"),
    reservedAt: new Date(),
  });
};

const cancelReservation = async (reservationId, userId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: toOid(reservationId, "reservationId"), 
      userId: toOid(userId, "userId"), 
      cancelledAt: { $exists: false } },
    { $set: { cancelledAt: new Date() } }
  );
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
const findReservationsByOwner = async (ownerId) => {
  const db = getDB();

  return await db.collection(COLLECTION).aggregate([
    {
      $match: {
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
    { $unwind: "$slot" },
    { $match: { "slot.ownerId": toOid(ownerId, "ownerId") } },
    {
      $lookup: {
        from:         "users",
        localField:   "userId",
        foreignField: "_id",
        as:           "user",
      },
    },
    { $unwind: "$user" },
    { $sort: { "slot.startTime": 1 } },
  ]).toArray();
};

// User view 
const findReservationsByUser = async (userId) => {
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
    { $match: { slot: { $ne: [] } } },
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