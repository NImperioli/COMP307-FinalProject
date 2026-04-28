// Nicholas Imperioli - 261120345
const bookingService = require("../services/bookingService");

// TYPE 1
exports.requestMeeting = async (req, res) => {
  try {
    const { ownerId, message, ownerEmail, proposedTime } = req.body;
    const userId    = req.user.id;        // from JWT
    const userEmail = req.user.email;     // injected by middleware 
    if (!ownerId || !message || !ownerEmail)
      return res.status(400).json({ error: "ownerId, message, and ownerEmail are required." });
    const result = await bookingService.requestMeeting(
      userId, ownerId, message, userEmail, ownerEmail, proposedTime
    );    
  res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.respondToRequest = async (req, res) => {
  try {
    const { bookingId, accepted } = req.body;
    const ownerId = req.user.id;          // from JWT — cannot be spoofed
    if (!bookingId || accepted === undefined)
      return res.status(400).json({ error: "bookingId and accepted are required." });
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
    const { ownerEmail, title, slots, opensAt, closesAt } = req.body;
    const ownerId = req.user.id;          // from JWT
    if (!ownerEmail || !title || !slots || !opensAt || !closesAt)
      return res.status(400).json({ error: "ownerEmail, title, slots, opensAt, closesAt are required." });
    const result = await bookingService.createGroupMeeting(ownerId, ownerEmail, title, slots, opensAt, closesAt);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.voteForSlots = async (req, res) => {
  try {
    const { bookingId, slotTimes } = req.body;
    const userId = req.user.id;           // from JWT
    if (!bookingId || !Array.isArray(slotTimes) || slotTimes.length === 0)
      return res.status(400).json({ error: "bookingId and slotTimes (array) are required." });
    const result = await bookingService.voteForSlots(bookingId, userId, slotTimes); // FIXED: 3 args
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
    const ownerId = req.user.id;          // from JWT
    if (!bookingId || !selectedTime || !ownerEmail)
      return res.status(400).json({ error: "bookingId, selectedTime, and ownerEmail are required." });
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

exports.getGroupInviteUrl = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const ownerId = req.user.id;
    const db = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (booking.ownerId.toString() !== ownerId)
      return res.status(403).json({ error: "Not your booking." });
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const url = `${baseUrl}/owner-slots.html?ownerId=${booking.ownerId}&bookingId=${bookingId}&openVote=true`;
    res.json({ inviteUrl: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.leaveGroupMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;
 
    const db = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
 
    let apptOid;
    try { apptOid = new ObjectId(appointmentId); }
    catch { return res.status(400).json({ error: "Invalid appointmentId." }); }
 
    const userOid = new ObjectId(userId);
 
    // Remove user from participants array on the appointment document
    const result = await db.collection("appointments").updateOne(
      { _id: apptOid, participants: userOid },
      { $pull: { participants: userOid } }
    );
 
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Appointment not found or you are not a participant." });
    }
 
    res.json({ message: "You have been removed from this group meeting.", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
