// Nicholas Imperioli - 261120345
const bookingService = require("../services/bookingService");

// TYPE 1
exports.requestMeeting = async (req, res) => {
  try {
    const { ownerId, message, ownerEmail, proposedTime } = req.body;
    const userId    = req.user.id;
    const userEmail = req.user.email;
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
    const ownerId = req.user.id;
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
    const ownerId = req.user.id;
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
    const userId = req.user.id;
    if (!bookingId || !Array.isArray(slotTimes) || slotTimes.length === 0)
      return res.status(400).json({ error: "bookingId and slotTimes (array) are required." });
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
    const ownerId = req.user.id;
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

exports.getOpenGroupBookings = async (req, res) => {
  try {
    const result = await bookingService.getOpenGroupBookings(req.params.ownerId);
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
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const baseUrl = process.env.BASE_URL || `${proto}://${host}`.replace(/\/$/, "");
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
    const result = await db.collection("appointments").updateOne(
      { _id: apptOid, participants: userOid },
      { $pull: { participants: userOid } }
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Appointment not found or you are not a participant." });
    res.json({ message: "You have been removed from this group meeting.", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = d => new Date(d).toLocaleString("en-CA", { timeZone: "America/Toronto" });

function toOid(val) {
  const { ObjectId } = require("mongodb");
  try { return new ObjectId(val); } catch { return null; }
}

// ─── CANCEL (all types) ───────────────────────────────────────────────────────
// TYPE_SLOT  → reservations collection  (pass reservationId as bookingId)
// TYPE1      → bookings collection
// TYPE2      → appointments collection
exports.cancelAnyBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId, type } = req.body;
    if (!bookingId || !type)
      return res.status(400).json({ error: "bookingId and type are required." });

    const db = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");

    // ── Slot reservation (single or recurring) ────────────────────────────────
    if (type === "TYPE_SLOT") {
      const resOid = toOid(bookingId);
      if (!resOid) return res.status(400).json({ error: "Invalid id." });

      const reservation = await db.collection("reservations").findOne({ _id: resOid });
      if (!reservation) return res.status(404).json({ error: "Reservation not found." });

      const slot    = await db.collection("slots").findOne({ _id: reservation.slotId });
      const isOwner = slot && slot.ownerId.toString() === userId;
      const isBooker = reservation.userId.toString() === userId;
      if (!isOwner && !isBooker) return res.status(403).json({ error: "Not authorized." });

      await db.collection("reservations").updateOne(
        { _id: resOid },
        { $set: { cancelledAt: new Date(), cancellationReason: "Cancelled by user" } }
      );

      const notify = [];
      const booker = await db.collection("users").findOne({ _id: reservation.userId });
      const owner  = slot ? await db.collection("users").findOne({ _id: slot.ownerId }) : null;

      if (slot && booker && owner) {
        if (isBooker) {
          notify.push(`mailto:${owner.email}?subject=${encodeURIComponent(`Booking cancelled — "${slot.title}"`)}&body=${encodeURIComponent(`Hi,\n\n${booker.name || booker.email} has cancelled their reservation for "${slot.title}" on ${fmt(slot.startTime)}.\n\nThis slot is now available.`)}`);
        } else {
          notify.push(`mailto:${booker.email}?subject=${encodeURIComponent(`Your booking "${slot.title}" was cancelled`)}&body=${encodeURIComponent(`Hi,\n\nYour booking "${slot.title}" on ${fmt(slot.startTime)} has been cancelled by the owner.\n\nPlease book another slot.`)}`);
        }
      }
      return res.json({ success: true, notify });
    }

    // ── TYPE 1 ────────────────────────────────────────────────────────────────
    if (type === "TYPE1") {
      const oid = toOid(bookingId);
      if (!oid) return res.status(400).json({ error: "Invalid id." });

      const booking = await db.collection("bookings").findOne({ _id: oid });
      if (!booking) return res.status(404).json({ error: "Booking not found." });

      const isOwner = booking.ownerId.toString() === userId;
      const isUser  = booking.userId.toString()  === userId;
      if (!isOwner && !isUser) return res.status(403).json({ error: "Not authorized." });

      await db.collection("slots").deleteMany({ bookingId: oid });
      await db.collection("bookings").deleteOne({ _id: oid });

      const subject = encodeURIComponent(`Meeting cancelled — "${booking.title || "Meeting Request"}"`);
      const body    = encodeURIComponent(`Hi,\n\nThe meeting "${booking.title || "Meeting Request"}" has been cancelled.`);
      const notify  = [
        `mailto:${booking.userEmail}?subject=${subject}&body=${body}`,
        `mailto:${booking.ownerEmail}?subject=${subject}&body=${body}`,
      ];
      return res.json({ success: true, notify });
    }

    // ── TYPE 2 ────────────────────────────────────────────────────────────────
    if (type === "TYPE2") {
      const oid = toOid(bookingId);
      if (!oid) return res.status(400).json({ error: "Invalid id." });

      const appt = await db.collection("appointments").findOne({ _id: oid });
      if (!appt) return res.status(404).json({ error: "Appointment not found." });

      const isOwner       = appt.ownerId.toString() === userId;
      const isParticipant = appt.participants?.some(p => p.toString() === userId);
      if (!isOwner && !isParticipant) return res.status(403).json({ error: "Not authorized." });

      const participantDocs = await db.collection("users")
        .find({ _id: { $in: (appt.participants || []).map(p => toOid(p)).filter(Boolean) } })
        .project({ email: 1, name: 1 })
        .toArray();

      if (isOwner) {
        // Owner cancels whole appointment — notify all participants
        await db.collection("appointments").deleteOne({ _id: oid });
        const notify = participantDocs.map(p =>
          `mailto:${p.email}?subject=${encodeURIComponent(`Group meeting cancelled — "${appt.title}"`)}&body=${encodeURIComponent(`Hi ${p.name || ""},\n\nThe group meeting "${appt.title}" scheduled for ${fmt(appt.time)} has been cancelled by the organizer.`)}`
        );
        return res.json({ success: true, notify });
      } else {
        // Participant leaves — notify owner
        await db.collection("appointments").updateOne(
          { _id: oid },
          { $pull: { participants: new ObjectId(userId) } }
        );
        const ownerDoc = await db.collection("users").findOne({ _id: appt.ownerId });
        const userDoc  = await db.collection("users").findOne({ _id: new ObjectId(userId) });
        const notify = ownerDoc
          ? [`mailto:${ownerDoc.email}?subject=${encodeURIComponent(`Participant left — "${appt.title}"`)}&body=${encodeURIComponent(`Hi,\n\n${userDoc?.name || userDoc?.email || "A participant"} has left the group meeting "${appt.title}" scheduled for ${fmt(appt.time)}.`)}`]
          : [];
        return res.json({ success: true, notify });
      }
    }

    return res.status(400).json({ error: "Invalid type. Use TYPE_SLOT, TYPE1, or TYPE2." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── COMPLETE (all types) ─────────────────────────────────────────────────────
// Either party (owner or student) marking it done persists for both.
exports.completeAnyBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId, type } = req.body;
    if (!bookingId || !type)
      return res.status(400).json({ error: "bookingId and type are required." });

    const db = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");

    // ── Slot reservation ──────────────────────────────────────────────────────
    if (type === "TYPE_SLOT") {
      const resOid = toOid(bookingId);
      if (!resOid) return res.status(400).json({ error: "Invalid id." });

      const reservation = await db.collection("reservations").findOne({ _id: resOid });
      if (!reservation) return res.status(404).json({ error: "Reservation not found." });

      const slot    = await db.collection("slots").findOne({ _id: reservation.slotId });
      const isOwner = slot && slot.ownerId.toString() === userId;
      const isBooker = reservation.userId.toString() === userId;
      if (!isOwner && !isBooker) return res.status(403).json({ error: "Not authorized." });

      // Idempotent
      if (reservation.status === "completed") return res.json({ success: true });

      await db.collection("reservations").updateOne(
        { _id: resOid },
        { $set: { status: "completed", completedAt: new Date() } }
      );
      return res.json({ success: true });
    }

    // ── TYPE 1 ────────────────────────────────────────────────────────────────
    if (type === "TYPE1") {
      const oid = toOid(bookingId);
      if (!oid) return res.status(400).json({ error: "Invalid id." });

      const booking = await db.collection("bookings").findOne({ _id: oid });
      if (!booking) return res.status(404).json({ error: "Booking not found." });

      const isOwner = booking.ownerId.toString() === userId;
      const isUser  = booking.userId.toString()  === userId;
      if (!isOwner && !isUser) return res.status(403).json({ error: "Not authorized." });
      if (booking.status === "completed") return res.json({ success: true });

      await db.collection("bookings").updateOne(
        { _id: oid },
        { $set: { status: "completed", completedAt: new Date() } }
      );
      return res.json({ success: true });
    }

    // ── TYPE 2 ────────────────────────────────────────────────────────────────
    if (type === "TYPE2") {
      const oid = toOid(bookingId);
      if (!oid) return res.status(400).json({ error: "Invalid id." });

      const appt = await db.collection("appointments").findOne({ _id: oid });
      if (!appt) return res.status(404).json({ error: "Appointment not found." });

      const isOwner       = appt.ownerId.toString() === userId;
      const isParticipant = appt.participants?.some(p => p.toString() === userId);
      if (!isOwner && !isParticipant) return res.status(403).json({ error: "Not authorized." });
      if (appt.status === "completed") return res.json({ success: true });

      await db.collection("appointments").updateOne(
        { _id: oid },
        { $set: { status: "completed", completedAt: new Date() } }
      );
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Invalid type. Use TYPE_SLOT, TYPE1, or TYPE2." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelGroupMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const ownerId = req.user.id;
    const result = await bookingService.cancelGroupMeeting(appointmentId, ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.completeGroupMeeting = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;
    const result = await bookingService.completeGroupMeeting(appointmentId, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};