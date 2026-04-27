// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const COLLECTION = "users";

const getRoleFromEmail = (email) => {
  const domain = email.split("@")[1];
  if (domain === "mcgill.ca") return "owner";
  if (domain === "mail.mcgill.ca") return "student";
  return null;
};

const createUser = async ({ email, name, password }) => {
  const db = getDB();
  const role = getRoleFromEmail(email);
  if (!role) throw new Error("Only @mcgill.ca or @mail.mcgill.ca emails can register.");
  const existing = await db.collection(COLLECTION).findOne({ email });
  if (existing) throw new Error("Email already registered.");
  return await db.collection(COLLECTION).insertOne({
    email, name, password, role, createdAt: new Date()
  });
};

const findUserByEmail = async (email) => {
  const db = getDB();
  return await db.collection(COLLECTION).findOne({ email });
};

const findUserById = async (id) => {
  const db = getDB();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
};

// All owners who have at least one active slot
const findActiveOwners = async () => {
  const db = getDB();
  const ownerIds = await db.collection("slots").distinct("ownerId", { status: "active" });
  return await db.collection(COLLECTION)
    .find({ _id: { $in: ownerIds }, role: "owner" })
    .toArray();
};

module.exports = { createUser, findUserByEmail, findUserById, findActiveOwners, getRoleFromEmail };