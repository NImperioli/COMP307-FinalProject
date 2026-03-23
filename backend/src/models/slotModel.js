// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const COLLECTION = "slots";

const createSlot = async (ownerId, { title, startTime, endTime }) => {
  const db = getDB();
  return await db.collection(COLLECTION).insertOne({
    ownerId: new ObjectId(ownerId),
    title,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: "private",
    inviteToken: crypto.randomUUID(),
    createdAt: new Date()
  });
};

const activateSlot = async (slotId, ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(slotId), ownerId: new ObjectId(ownerId) },
    { $set: { status: "active" } }
  );
};

const deleteSlot = async (slotId, ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION).deleteOne({
    _id: new ObjectId(slotId),
    ownerId: new ObjectId(ownerId)
  });
};

const findSlotsByOwner = async (ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ ownerId: new ObjectId(ownerId) })
    .sort({ startTime: 1 })
    .toArray();
};

const findActiveSlotsByOwner = async (ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ ownerId: new ObjectId(ownerId), status: "active" })
    .sort({ startTime: 1 })
    .toArray();
};

const findSlotByToken = async (inviteToken) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ inviteToken, status: "active" })
    .toArray();
};

const findSlotById = async (slotId) => {
  const db = getDB();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(slotId) });
};

module.exports = {
  createSlot, activateSlot, deleteSlot,
  findSlotsByOwner, findActiveSlotsByOwner,
  findSlotByToken, findSlotById
};