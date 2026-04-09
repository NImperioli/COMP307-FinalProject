// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const COLLECTION = "slots";

// Helper
function expandWeeklyOccurrences(baseTime, weeks) {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const base = new Date(baseTime);
  return Array.from({ length: weeks }, (_, i) => new Date(base.getTime() + i * MS_PER_WEEK));
}

const createSlot = async (ownerId, { title, startTime, endTime }) => {
  const db = getDB();
  return await db.collection(COLLECTION).insertOne({
    ownerId: new ObjectId(ownerId),
    title,
     type: "single",
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: "private",
    inviteToken: crypto.randomUUID(),
    createdAt: new Date()
  });
};

// Type 3
const createRecurringSlots = async (ownerId, weeklySlots, weeks) => {
  const db = getDB();
  if (!Array.isArray(weeklySlots) || weeklySlots.length === 0) {
    throw new Error("weeklySlots must be a non-empty array.");
  }
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error("weeks must be a positive integer.");
  }

  const groupToken = crypto.randomUUID();

  const docs = [];
  for (const slot of weeklySlots) {
    const startOccurrences = expandWeeklyOccurrences(slot.startTime, weeks);
    const endOccurrences   = expandWeeklyOccurrences(slot.endTime,   weeks);

    for (let w = 0; w < weeks; w++) {
      docs.push({
        ownerId:     new ObjectId(ownerId),
        title:       slot.title,
        type:        "recurring",
        weekNumber:  w + 1,           // 1-indexed week within the recurrence
        startTime:   startOccurrences[w],
        endTime:     endOccurrences[w],
        status:      "private",
        groupToken,                   // shared across all occurrences of this series
        inviteToken: groupToken,      // invitation URL uses groupToken for recurring sets
        createdAt:   new Date(),
      });
    }
  }

  const result = await db.collection(COLLECTION).insertMany(docs);
  return {
    insertedCount: result.insertedCount,
    groupToken,
    insertedIds: Object.values(result.insertedIds),
  };
};

// Activation / Privacy
const activateSlot = async (slotId, ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(slotId), ownerId: new ObjectId(ownerId) },
    { $set: { status: "active" } }
  );
};

const activateSlotsByGroup = async (groupToken, ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateMany(
    { groupToken, ownerId: new ObjectId(ownerId), status: "private" },
    { $set: { status: "active" } }
  );
};

const deactivateSlot = async (slotId, ownerId) => {
  const db = getDB();
  // Check for active reservation before deactivating
  const reservation = await db.collection("reservations").findOne({
    slotId: new ObjectId(slotId),
    cancelledAt: { $exists: false },
  });
  if (reservation) throw new Error("Cannot deactivate a slot that has an active reservation.");
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(slotId), ownerId: new ObjectId(ownerId), status: "active" },
    { $set: { status: "private" } }
  );
};

const deleteSlot = async (slotId, ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION).deleteOne({
    _id:     new ObjectId(slotId),
    ownerId: new ObjectId(ownerId),
  });
};

const deleteSlotsByGroup = async (groupToken, ownerId) => {
  const db = getDB();

  // Find all slots in the group owned by this owner
  const groupSlots = await db.collection(COLLECTION)
    .find({ groupToken, ownerId: new ObjectId(ownerId) })
    .toArray();

  if (groupSlots.length === 0) return { deletedCount: 0, skippedIds: [] };

  const slotIds = groupSlots.map(s => s._id);

  // Find which ones have active reservations
  const reserved = await db.collection("reservations")
    .find({ slotId: { $in: slotIds }, cancelledAt: { $exists: false } })
    .toArray();

  const reservedSlotIds = new Set(reserved.map(r => r.slotId.toString()));
  const deletableIds    = slotIds.filter(id => !reservedSlotIds.has(id.toString()));
  const skippedIds      = slotIds.filter(id =>  reservedSlotIds.has(id.toString()));

  let deletedCount = 0;
  if (deletableIds.length > 0) {
    const result = await db.collection(COLLECTION).deleteMany({
      _id: { $in: deletableIds },
    });
    deletedCount = result.deletedCount;
  }

  return { deletedCount, skippedIds };
};

// Queries
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

const findSlotsByGroup = async (groupToken) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ groupToken })
    .sort({ startTime: 1 })
    .toArray();
};

const findActiveOwners = async () => {
  const db = getDB();
  const ownerIds = await db.collection(COLLECTION).distinct("ownerId", { status: "active" });
  return await db.collection("users")
    .find({ _id: { $in: ownerIds }, role: "owner" })
    .toArray();
};

module.exports = {
  // Single slot
  createSlot,
  activateSlot,
  deactivateSlot,
  deleteSlot,
  // Recurring (Type 3)
  createRecurringSlots,
  activateSlotsByGroup,
  deleteSlotsByGroup,
  findSlotsByGroup,
  // Queries
  findSlotsByOwner,
  findActiveSlotsByOwner,
  findSlotByToken,
  findSlotById,
  findActiveOwners,
};