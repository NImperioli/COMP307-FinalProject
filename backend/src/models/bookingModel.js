//Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");

const COLLECTION = "bookings";

const createBooking = async (booking) => {
  const db = getDB();
  return await db.collection(COLLECTION).insertOne(booking);
};

const findBookings = async (query) => {
  const db = getDB();
  return await db.collection(COLLECTION).find(query).toArray();
};

const updateBooking = async (id, update) => {
  const db = getDB();
  const { ObjectId } = require("mongodb");

  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
};

module.exports = {
  createBooking,
  findBookings,
  updateBooking
};