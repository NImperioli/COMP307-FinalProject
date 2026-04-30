// Nicholas Imperioli - 261120345
const express = require("express");
const router  = express.Router();
const { buildICS } = require("../services/icalService");
const { getDB }    = require("../config/db");
const { ObjectId } = require("mongodb");
const auth = require("../middleware/authMiddleware");

function toOid(val) {
  try { return new ObjectId(val); } catch { return null; }
}

// Single slot 
router.get("/slot/:id", auth.authenticateAnyToken, async (req, res) => {
  try {
    const db  = getDB();
    const oid = toOid(req.params.id);
    if (!oid) return res.status(400).json({ error: "Invalid id." });

    const slot = await db.collection("slots").findOne({ _id: oid });
    if (!slot) return res.status(404).json({ error: "Slot not found." });

    // Fetch booker name if reserved
    let description = "Booking slot — MyBookings";
    const reservation = await db.collection("reservations").findOne({
      slotId: oid, cancelledAt: { $exists: false }
    });
    if (reservation) {
      const booker = await db.collection("users").findOne({ _id: reservation.userId });
      if (booker) description += `\nBooked by: ${booker.name} (${booker.email})`;
    }

    const ics = buildICS([{
      title: slot.title,
      start: slot.startTime,
      end:   slot.endTime,
      description,
    }]);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${slot.title || "slot"}.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single group appointment (Type 2)
router.get("/group/:appointmentId", auth.authenticateAnyToken, async (req, res) => {
  try {
    const db  = getDB();
    const oid = toOid(req.params.appointmentId);
    if (!oid) return res.status(400).json({ error: "Invalid id." });

    const appt = await db.collection("appointments").findOne({ _id: oid });
    if (!appt) return res.status(404).json({ error: "Appointment not found." });

    // Resolve participant names
    const participantDocs = appt.participants?.length
      ? await db.collection("users")
          .find({ _id: { $in: appt.participants.map(p => toOid(p)).filter(Boolean) } })
          .project({ name: 1, email: 1 })
          .toArray()
      : [];

    const participantList = participantDocs
      .map(p => `  • ${p.name || p.email} (${p.email})`)
      .join("\n");

    const start = new Date(appt.time);
    const end   = new Date(start.getTime() + 60 * 60 * 1000);

    const description = [
      appt.isRecurring ? `Recurring group meeting — week ${appt.weekNumber}` : "Group meeting — MyBookings",
      `Organizer: ${appt.ownerEmail || ""}`,
      participantList ? `\nParticipants:\n${participantList}` : "",
    ].filter(Boolean).join("\n");

    const ics = buildICS([{
      title:       appt.title || "Group Meeting",
      start,
      end,
      description,
      organizer:   appt.ownerEmail,
    }]);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="group-meeting.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Owner: export ALL events
router.get("/owner/:ownerId/all", auth.authenticateOwnerToken, async (req, res) => {
  try {
    const db = getDB();
    const ownerOid = toOid(req.params.ownerId);
    if (!ownerOid) return res.status(400).json({ error: "Invalid ownerId." });

    if (req.user.id.toString() !== req.params.ownerId.toString())
      return res.status(403).json({ error: "Forbidden." });

    const events = [];

    // 1. Slots — fetch active reservations in one query then map
    const slots = await db.collection("slots").find({ ownerId: ownerOid }).toArray();
    const slotIds = slots.map(s => s._id);

    const reservations = slotIds.length
      ? await db.collection("reservations")
          .find({ slotId: { $in: slotIds }, cancelledAt: { $exists: false } })
          .toArray()
      : [];

    // resolve booker names
    const bookerIds = [...new Set(reservations.map(r => r.userId.toString()))];
    const bookerDocs = bookerIds.length
      ? await db.collection("users")
          .find({ _id: { $in: bookerIds.map(id => toOid(id)).filter(Boolean) } })
          .project({ name: 1, email: 1 })
          .toArray()
      : [];
    const bookerMap = new Map(bookerDocs.map(u => [u._id.toString(), u]));
    const resMap    = new Map(reservations.map(r => [r.slotId.toString(), r]));

    for (const s of slots) {
      const res = resMap.get(s._id.toString());
      let description = "Booking slot — MyBookings";
      if (res) {
        const booker = bookerMap.get(res.userId.toString());
        if (booker) description += `\nBooked by: ${booker.name || booker.email} (${booker.email})`;
      }
      events.push({ title: s.title, start: s.startTime, end: s.endTime, description });
    }

    // 2. Type 1 approved meeting requests
    const type1 = await db.collection("bookings")
      .find({ ownerId: ownerOid, type: "TYPE1", status: { $in: ["approved", "completed"] } })
      .toArray();

    for (const b of type1) {
      if (!b.proposedTime) continue;
      const start = new Date(b.proposedTime);
      const end   = new Date(start.getTime() + 30 * 60 * 1000);
      events.push({
        title:       b.title || `Meeting with ${b.userEmail}`,
        start,
        end,
        description: `Meeting request from ${b.userEmail}\nStatus: ${b.status}`,
        organizer:   b.ownerEmail,
      });
    }

    // 3. Type 2 group appointments — include participant names
    const type2 = await db.collection("appointments").find({ ownerId: ownerOid }).toArray();

    // batch-resolve all participant users across all appointments
    const allParticipantIds = [...new Set(
      type2.flatMap(a => (a.participants || []).map(p => p.toString()))
    )];
    const allParticipantDocs = allParticipantIds.length
      ? await db.collection("users")
          .find({ _id: { $in: allParticipantIds.map(id => toOid(id)).filter(Boolean) } })
          .project({ name: 1, email: 1 })
          .toArray()
      : [];
    const participantMap = new Map(allParticipantDocs.map(u => [u._id.toString(), u]));

    for (const a of type2) {
      const start = new Date(a.time);
      const end   = new Date(start.getTime() + 60 * 60 * 1000);

      const participantList = (a.participants || [])
        .map(p => {
          const u = participantMap.get(p.toString());
          return u ? `  • ${u.name || u.email} (${u.email})` : null;
        })
        .filter(Boolean)
        .join("\n");

      const description = [
        a.isRecurring ? `Recurring group meeting — week ${a.weekNumber}` : "Group meeting — MyBookings",
        `Status: ${a.status || "scheduled"}`,
        participantList ? `\nParticipants:\n${participantList}` : "",
      ].filter(Boolean).join("\n");

      events.push({
        title:       a.title || "Group Meeting",
        start,
        end,
        description,
        organizer:   a.ownerEmail,
      });
    }

    const ics = buildICS(events);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=all-events.ics");
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;