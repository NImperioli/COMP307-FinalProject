// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const COLLECTION = "reservations";

const reserveSlot = async (slotId, userId) => {
  const db = getDB();
  const taken = await db.collection(COLLECTION).findOne({
    slotId: new ObjectId(slotId),
    cancelledAt: { $exists: false }
  });
  if (taken) throw new Error("Slot already reserved.");
  return await db.collection(COLLECTION).insertOne({
    slotId: new ObjectId(slotId),
    userId: new ObjectId(userId),
    reservedAt: new Date()
  });
};

const cancelReservation = async (reservationId, userId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(reservationId), userId: new ObjectId(userId), cancelledAt: { $exists: false } },
    { $set: { cancelledAt: new Date() } }
  );
};

// All active reservations for a user
const findReservationsByUser = async (userId) => {
  const db = getDB();
  return await db.collection(COLLECTION).aggregate([
    { $match: { userId: new ObjectId(userId), cancelledAt: { $exists: false } } },
    { $lookup: { from: "slots", localField: "slotId", foreignField: "_id", as: "slot" } },
    { $lookup: { from: "users", localField: "slot.ownerId", foreignField: "_id", as: "owner" } },
    { $unwind: "$slot" },
    { $unwind: "$owner" }
  ]).toArray();
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

// Used for notification emails on delete/cancel
const findReservationWithDetails = async (reservationId) => {
  const db = getDB();
  const [result] = await db.collection(COLLECTION).aggregate([
    { $match: { _id: new ObjectId(reservationId) } },
    { $lookup: { from: "slots", localField: "slotId", foreignField: "_id", as: "slot" } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$slot" },
    { $unwind: "$user" }
  ]).toArray();
  return result || null;
};

module.exports = {
  reserveSlot, cancelReservation,
  findReservationsByUser, findReservationBySlot,
  findReservationWithDetails
};