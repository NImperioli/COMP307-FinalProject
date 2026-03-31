// Nicholas Imperioli - 261120345
const { getDB } = require("../config/db");
const { ObjectId } = require("mongodb");
const bookingService = require("../services/bookingService");
const COLLECTION = "bookings";

const createBooking = async (booking) => {
  const db = getDB();
  return await db.collection(COLLECTION).insertOne(booking);
};

const findBookings = async (query) => {
  const db = getDB();
  return await db.collection(COLLECTION).find(query).toArray();
};

const findBookingById = async (id) => {
  const db = getDB();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
};

const updateBooking = async (id, update) => {
  const db = getDB();
  return await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );
};

// TYPE 1
exports.requestMeeting = async (req, res) => {
  try {
    const { userId, ownerId, message, userEmail, ownerEmail } = req.body;
    const result = await bookingService.requestMeeting(userId, ownerId, message, userEmail, ownerEmail);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.respondToRequest = async (req, res) => {
  try {
    const { bookingId, accepted } = req.body;
    const result = await bookingService.respondToRequest(bookingId, accepted);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getUserMeetingRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await bookingService.getUserMeetingRequests(userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getOwnerMeetingRequests = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const result = await bookingService.getOwnerMeetingRequests(ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getOwnerPendingRequests = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const result = await bookingService.getOwnerPendingRequests(ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
// TYPE 2
exports.createGroupMeeting = async (req, res) => {
  try {
    const { ownerId, ownerEmail, title, slots, opensAt, closesAt } = req.body;
    const result = await bookingService.createGroupMeeting(ownerId, ownerEmail, title, slots, opensAt, closesAt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.voteForSlots = async (req, res) => {
  try {
    const { bookingId, userId, slotTimes } = req.body;
    const result = await bookingService.voteForSlots(bookingId, userId, slotTimes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getSlotVoteCounts = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const result = await bookingService.getSlotVoteCounts(bookingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.finalizeGroupMeeting = async (req, res) => {
  try {
    const { bookingId, selectedTime, repeatWeeks, ownerEmail } = req.body;
    const result = await bookingService.finalizeGroupMeeting(bookingId, selectedTime, repeatWeeks, ownerEmail);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getUserAppointments = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await bookingService.getUserAppointments(userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.getOwnerAppointments = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const result = await bookingService.getOwnerAppointments(ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
// TYPE 3 
exports.createOfficeHours = async (req, res) => {
  try {
    const { ownerId, slots, weeks } = req.body;
    const result = await bookingService.createOfficeHours(ownerId, slots, weeks);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
 
exports.reserveOfficeHour = async (req, res) => {
  try {
    const { bookingId, slotTime, userId } = req.body;
    const result = await bookingService.reserveOfficeHour(bookingId, slotTime, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createBooking,
  findBookings,
  findBookingById, 
  updateBooking
};