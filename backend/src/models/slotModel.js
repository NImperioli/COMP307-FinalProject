// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const crypto = require("crypto");
const COLLECTION = "slots";

// Helpers
function expandWeeklyOccurrences(baseTime, weeks) {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const base = new Date(baseTime);
  return Array.from({ length: weeks }, (_, i) => new Date(base.getTime() + i * MS_PER_WEEK));
}

const toOid = (val, label = "id") => {
  try {
    return new ObjectId(val);
  } catch {
    throw new Error(`Invalid ${label}: "${val}"`);
  }
};

const createSlot = async (ownerId,  title, startTime, endTime ) => {
  const db = getDB();

  // Integrity
  const start = new Date(startTime);
  const end   = new Date(endTime);
  if (isNaN(start.getTime())) throw new Error("startTime is not a valid date.");
  if (isNaN(end.getTime()))   throw new Error("endTime is not a valid date.");
  if (end <= start)           throw new Error("endTime must be after startTime.");
  if (start < new Date())     throw new Error("startTime must be in the future.");

  return await db.collection(COLLECTION).insertOne({
    ownerId: toOid(ownerId, "ownerId"),
    title:       title?.trim(),
    type:        "single",
    startTime:   start,
    endTime:     end,
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
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    if (isNaN(start.getTime())) throw new Error(`Invalid startTime for slot "${slot.title}".`);
    if (isNaN(end.getTime()))   throw new Error(`Invalid endTime for slot "${slot.title}".`);
    if (end <= start) {
      throw new Error(`Invalid time range for slot "${slot.title}": End time must be after start time.`);
    }

    const startOccurrences = expandWeeklyOccurrences(slot.startTime, weeks);
    const endOccurrences = expandWeeklyOccurrences(slot.endTime, weeks);

    for (let w = 0; w < weeks; w++) {
      docs.push({
        ownerId:     toOid(ownerId, "ownerId"),
        title:       slot.title?.trim(),
        type:        "recurring",
        weekNumber:  w + 1,
        startTime:   startOccurrences[w],
        endTime:     endOccurrences[w],
        status:      "private",
        groupToken,
        inviteToken: groupToken,
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
    { _id: toOid(slotId, "slotId"), ownerId: toOid(ownerId, "ownerId") },
    { $set: { status: "active" } }
  );
};

const activateSlotsByGroup = async (groupToken, userId) => {
  const db = getDB();

  return await db.collection(COLLECTION).updateMany(
    { groupToken, ownerId: toOid(userId, "userId"), status: "private" },
    { $set: { status: "active" } }
  );

};

const deactivateSlotsByGroup = async (groupToken, userId) => {
  const db = getDB();
  const slots = await db.collection(COLLECTION)
    .find({ groupToken, ownerId: toOid(userId, "userId"), status: "active" })
    .toArray();

  const slotIds = slots.map(s => s._id);
  const reserved = await db.collection("reservations")
    .find({ slotId: { $in: slotIds }, cancelledAt: { $exists: false } })
    .toArray();

  const reservedIds = new Set(reserved.map(r => r.slotId.toString()));
  const deactivatable = slotIds.filter(id => !reservedIds.has(id.toString()));

  if (deactivatable.length === 0) {
    return { modifiedCount: 0, skippedCount: slotIds.length };
  }

  const result = await db.collection(COLLECTION).updateMany(
    { _id: { $in: deactivatable } },
    { $set: { status: "private" } }
  );

  return { modifiedCount: result.modifiedCount, skippedCount: reservedIds.size };
};

const deactivateSlot = async (slotId, ownerId) => {
  const db = getDB();
  // Check for active reservation before deactivating
  const reservation = await db.collection("reservations").findOne({
    slotId: toOid(slotId, "slotId"),
    cancelledAt: { $exists: false },
  });
  if (reservation) throw new Error("Cannot deactivate a slot that has an active reservation.");
  return await db.collection(COLLECTION).updateOne(
    { _id: toOid(slotId, "slotId"), ownerId: toOid(ownerId, "ownerId"), status: "active" },
    { $set: { status: "private" } }
  );
};

const deleteSlot = async (slotId, ownerId) => {
  const db = getDB();
  const slotObjectId = toOid(slotId, "slotId");

  await db.collection("reservations").updateMany(
    {
      slotId: slotObjectId,
      cancelledAt: { $exists: false }
    },
    {
      $set: {
        cancelledAt: new Date(),
        cancellationReason: "Slot deleted by owner"
      }
    }
  );
  
  return await db.collection(COLLECTION).deleteOne({
    _id:     toOid(slotId, "slotId"),
    ownerId: toOid(ownerId, "ownerId"),
  });
};

const deleteSlotsByGroup = async (groupToken, ownerId, reservationMap = new Map()) => {
  const db = getDB();
  const groupSlots = await db.collection(COLLECTION)
    .find({ groupToken, ownerId: toOid(ownerId, "ownerId") })
    .toArray();

  if (groupSlots.length === 0) return { deletedCount: 0, skippedIds: [] };

  const slotIds = groupSlots.map(s => s._id);

  // If no map was provided, fetch reservations now
  if (reservationMap.size === 0) {
    const active = await db.collection("reservations")
      .find({ slotId: { $in: slotIds }, cancelledAt: { $exists: false } })
      .toArray();
    for (const r of active) reservationMap.set(r.slotId.toString(), r);
  }

  if (slotIds.length > 0) {
    await db.collection("reservations").updateMany(
      { slotId: { $in: slotIds }, cancelledAt: { $exists: false } },
      { $set: { cancelledAt: new Date(), cancellationReason: "Slot group deleted by owner" } }
    );
  }

  let deletedCount = 0;
  if (slotIds.length > 0) {
    const result = await db.collection(COLLECTION).deleteMany({ _id: { $in: slotIds } });
    deletedCount = result.deletedCount;
  }

  return { deletedCount, skippedIds: [] };
};

// Queries
const findSlotsByOwner = async (ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ ownerId: toOid(ownerId, "ownerId") })
    .sort({ startTime: 1 })
    .toArray();
};

const findActiveSlotsByOwner = async (ownerId) => {
  const db = getDB();
  return await db.collection(COLLECTION)
    .find({ ownerId: toOid(ownerId, "ownerId"), status: "active" })
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
  return await db.collection(COLLECTION).findOne({ _id: toOid(slotId, "slotId") });
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
  deactivateSlotsByGroup,
  deleteSlotsByGroup,
  findSlotsByGroup,
  // Queries
  findSlotsByOwner,
  findActiveSlotsByOwner,
  findSlotByToken,
  findSlotById,
  findActiveOwners,
};