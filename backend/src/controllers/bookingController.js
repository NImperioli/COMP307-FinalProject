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
    const { bookingId, accepted } = req.body;
    if (!bookingId || accepted === undefined)
      return res.status(400).json({ error: "bookingId and accepted are required." });
    const result = await bookingService.respondToRequest(bookingId, accepted);
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
    const { bookingId, userId, slotTimes } = req.body;
    if (!bookingId || !userId || !Array.isArray(slotTimes) || slotTimes.length === 0)
      return res.status(400).json({ error: "bookingId, userId, and slotTimes (array) are required." });
    const result = await bookingService.voteForSlots(bookingId, userId, slotTimes);
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
    const { bookingId, selectedTime, repeatWeeks, ownerEmail } = req.body;
    if (!bookingId || !selectedTime || !ownerEmail)
      return res.status(400).json({ error: "bookingId, selectedTime, and ownerEmail are required." });
    const result = await bookingService.finalizeGroupMeeting(bookingId, selectedTime, repeatWeeks, ownerEmail);
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
