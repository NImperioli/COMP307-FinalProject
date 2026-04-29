const express = require("express");
const router = express.Router();
const { buildICS } = require("../services/icalService");
const { getDB } = require("../config/db");

// single event export
router.get("/slot/:id", async (req, res) => {
  const db = getDB();

  const slot = await db.collection("slots").findOne({ _id: req.params.id });

  if (!slot) return res.status(404).json({ error: "Not found" });

  const ics = buildICS([
    {
      title: slot.title,
      start: slot.startTime,
      end: slot.endTime,
      description: "MyBookings Slot",
      organizer: slot.ownerEmail,
    },
  ]);

  res.setHeader("Content-Type", "text/calendar");
  res.setHeader("Content-Disposition", "attachment; filename=event.ics");
  res.send(ics);
});

// export ALL (owner)
router.get("/owner/:ownerId/all", async (req, res) => {
  const db = getDB();

  const slots = await db.collection("slots")
    .find({ ownerId: req.params.ownerId })
    .toArray();

  const events = slots.map(s => ({
    title: s.title,
    start: s.startTime,
    end: s.endTime,
    description: "Slot",
    organizer: s.ownerEmail
  }));

  const ics = buildICS(events);

  res.setHeader("Content-Type", "text/calendar");
  res.setHeader("Content-Disposition", "attachment; filename=all-events.ics");
  res.send(ics);
});

module.exports = router;