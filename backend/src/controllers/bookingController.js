// Nicholas Imperioli - 261120345
const bookingService = require("../services/bookingService");

// TYPE 1 
exports.requestMeeting = async (req, res) => {
  try {
    const { userId, ownerId, message, userEmail, ownerEmail } = req.body;
    if (!userId || !ownerId || !message || !userEmail || !ownerEmail)
      return res.status(400).json({ error: "userId, ownerId, message, userEmail, ownerEmail are all required." });
    const result = await bookingService.requestMeeting(userId, ownerId, message, userEmail, ownerEmail);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.respondToRequest = async (req, res) => {
  try {
    const { bookingId, accepted, ownerId } = req.body;
    if (!bookingId || accepted === undefined || !ownerId)
      return res.status(400).json({ error: "bookingId, accepted, and ownerId are required." });
    const result = await bookingService.respondToRequest(bookingId, accepted, ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserMeetingRequests = async (req, res) => {
  try {
    const result = await bookingService.getUserMeetingRequests(req.params.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOwnerMeetingRequests = async (req, res) => {
  try {
    const result = await bookingService.getOwnerMeetingRequests(req.params.ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOwnerPendingRequests = async (req, res) => {
  try {
    const result = await bookingService.getOwnerPendingRequests(req.params.ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// TYPE 2 

exports.createGroupMeeting = async (req, res) => {
  try {
    const { ownerId, ownerEmail, title, slots, opensAt, closesAt } = req.body;
    if (!ownerId || !ownerEmail || !title || !slots || !opensAt || !closesAt)
      return res.status(400).json({ error: "ownerId, ownerEmail, title, slots, opensAt, closesAt are all required." });
    const result = await bookingService.createGroupMeeting(ownerId, ownerEmail, title, slots, opensAt, closesAt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.voteForSlots = async (req, res) => {
  try {
    const { bookingId, userId, slotTimes, ownerId } = req.body;
    if (!bookingId || !userId || !Array.isArray(slotTimes) || slotTimes.length === 0 || !ownerId)
      return res.status(400).json({ error: "bookingId, userId, slotTimes (array), and ownerId are required." });
    const result = await bookingService.voteForSlots(bookingId, userId, slotTimes, ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSlotVoteCounts = async (req, res) => {
  try {
    const result = await bookingService.getSlotVoteCounts(req.params.bookingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.finalizeGroupMeeting = async (req, res) => {
  try {
    const { bookingId, selectedTime, repeatWeeks, ownerEmail, ownerId } = req.body;
    if (!bookingId || !selectedTime || !ownerEmail || !ownerId)
      return res.status(400).json({ error: "bookingId, selectedTime, ownerEmail, and ownerId are required." });
    const result = await bookingService.finalizeGroupMeeting(bookingId, selectedTime, repeatWeeks, ownerEmail, ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserAppointments = async (req, res) => {
  try {
    const result = await bookingService.getUserAppointments(req.params.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOwnerAppointments = async (req, res) => {
  try {
    const result = await bookingService.getOwnerAppointments(req.params.ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
