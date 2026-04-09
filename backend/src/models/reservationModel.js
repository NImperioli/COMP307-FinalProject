// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const COLLECTION = "reservations";

const reserveSlot = async (slotId, userId) => {
  const db = getDB();

  // Confirm slot exists and is active
  const slot = await db.collection("slots").findOne({ _id: new ObjectId(slotId) });
  if (!slot) throw new Error("Slot not found.");
  if (slot.status !== "active") throw new Error("Slot is not available for booking.");

  // Prevent double-booking
  const existing = await db.collection(COLLECTION).findOne({
    slotId:      new ObjectId(slotId),
    cancelledAt: { $exists: false },
  });
  if (existing) throw new Error("Slot is already reserved.");

  return await db.collection(COLLECTION).insertOne({
    slotId:     new ObjectId(slotId),
    userId:     new ObjectId(userId),
    reservedAt: new Date(),
  });
};

const cancelReservation = async (reservationId, userId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(reservationId), userId: new ObjectId(userId), cancelledAt: { $exists: false } },
    { $set: { cancelledAt: new Date() } }
  );
};

// Who booked a slot (owners view)
const findReservationBySlot = async (slotId) => {
  const db = getDB();
  const [result] = await db.collection(COLLECTION).aggregate([
    { $match: { slotId: new ObjectId(slotId), cancelledAt: { $exists: false } } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" }
  ]).toArray();
  return result || null;
};

// Owner view
const findReservationsByOwner = async (ownerId) => {
  const db = getDB();

  // Get all slot IDs belonging to this owner
  const ownerSlots = await db.collection("slots")
    .find({ ownerId: new ObjectId(ownerId) })
    .project({ _id: 1 })
    .toArray();

  const slotIds = ownerSlots.map(s => s._id);
  if (slotIds.length === 0) return [];

  return await db.collection(COLLECTION).aggregate([
    {
      $match: {
        slotId:      { $in: slotIds },
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
    {
      $lookup: {
        from:         "users",
        localField:   "userId",
        foreignField: "_id",
        as:           "user",
      },
    },
    { $unwind: "$slot" },
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
        userId:      new ObjectId(userId),
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
    {
      $lookup: {
        from:         "users",
        localField:   "slot.ownerId",
        foreignField: "_id",
        as:           "owner",
      },
    },
    { $unwind: "$slot" },
    { $unwind: "$owner" },
    { $sort: { "slot.startTime": 1 } },
  ]).toArray();
};

// Notification helper
const findReservationWithDetails = async (reservationId) => {
  const db = getDB();
  const [result] = await db.collection(COLLECTION).aggregate([
    { $match: { _id: new ObjectId(reservationId) } },
    {
      $lookup: {
        from:         "slots",
        localField:   "slotId",
        foreignField: "_id",
        as:           "slot",
      },
    },
    {
      $lookup: {
        from:         "users",
        localField:   "userId",
        foreignField: "_id",
        as:           "user",
      },
    },
    { $unwind: "$slot" },
    { $unwind: "$user" },
  ]).toArray();

  return result ?? null;
};

module.exports = {
  reserveSlot,
  cancelReservation,
  findReservationBySlot,
  findReservationsByOwner,
  findReservationsByUser,
  findReservationWithDetails,
};