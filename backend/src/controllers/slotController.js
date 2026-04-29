// Nicholas Imperioli - 261120345
const {
  createSlot,
  createRecurringSlots,
  activateSlot,
  activateSlotsByGroup,
  deactivateSlotsByGroup,
  deactivateSlot,
  deleteSlot,
  deleteSlotsByGroup,
  findSlotsByGroup,
  findSlotsByOwner,
  findActiveSlotsByOwner,
  findSlotByToken,
  findSlotById,
  findActiveOwners,
} = require("../models/slotModel");

const {
  reserveSlot,
  cancelReservation,
  findReservationBySlot,
  findReservationsByOwner,
  findReservationsByUser,
  findReservationWithDetails,
  findActiveReservationsBySlotIds,
} = require("../models/reservationModel");

const {
  slotDeletedNotification,
  reservationCancelledNotification,
  slotReservedNotification,
  ownerMessageToBooker:  buildOwnerToBookerMailto,
  userMessageToOwner:    buildUserToOwnerMailto,
  buildInviteUrl,
} = require("../services/notificationService");

const { buildICS } = require("../services/icalService");

// Slot management (owner)

exports.createSlot = async (req, res) => {
  try {
    const { title, start, end } = req.body;
    const ownerId = req.user.id;          // from JWT
    if (!title || !start || !end)
      return res.status(400).json({ error: "title, start, and end are required." });
    const result = await createSlot(ownerId, title, start, end);
    const db = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
    const inserted = await db.collection("slots").findOne({ _id: result.insertedId });
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRecurringSlots = async (req, res) => {
  try {
    const { weeklySlots, weeks } = req.body;  
    const ownerId = req.user.id;
    if (!weeklySlots || !weeks) {
      return res.status(400).json({
        error: "weeklySlots and weeks are required."
      });
    }
    const result = await createRecurringSlots(ownerId, weeklySlots, weeks);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.activateSlot = async (req, res) => {
  try {
    const ownerId = req.user.id;          // from JWT
    const result = await activateSlot(req.params.slotId, ownerId);
    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Slot not found or you are not the owner." });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.activateSlotsByGroup = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const result = await activateSlotsByGroup(req.params.groupToken, ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateSlotsByGroup = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const result = await deactivateSlotsByGroup(req.params.groupToken, ownerId);
    if (result.modifiedCount === 0 && result.skippedCount > 0) {
      return res.status(400).json({ 
        error: `All slots have active reservations and cannot be deactivated.` 
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateSlot = async (req, res) => {
  try {
    const ownerId = req.user.id;          // from JWT
    const result = await deactivateSlot(req.params.slotId, ownerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteSlot = async (req, res) => {
  try {
    const ownerId = req.user.id;          // from JWT
    const slot = await findSlotById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });

    const reservation = await findReservationBySlot(req.params.slotId);
    let notifyBooker = null;
    if (reservation) {
      notifyBooker = slotDeletedNotification(reservation.user.email, slot);
    }

    const result = await deleteSlot(req.params.slotId, ownerId);
    if (result.deletedCount === 0)
      return res.status(403).json({ error: "Slot not found or you are not the owner." });

    res.json({ result, notifyBooker });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSlotsByGroup = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { groupToken } = req.params;

    const groupSlots = await findSlotsByGroup(groupToken);
    const slotIds = groupSlots.map(s => s._id);
    const reservationMap = await findActiveReservationsBySlotIds(slotIds);

    const notifyBookers = [];
    for (const slot of groupSlots) {
      const reservation = reservationMap.get(slot._id.toString());
      if (reservation) {
        notifyBookers.push(slotDeletedNotification(reservation.user.email, slot));
      }
    }

    const { deletedCount, skippedIds } = await deleteSlotsByGroup(groupToken, ownerId, reservationMap);
    const warning = skippedIds.length > 0
      ? `${skippedIds.length} slot(s) could not be deleted because they have active reservations.`
      : null;
    res.json({ result: { deletedCount, skippedIds, warning }, notifyBookers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findSlotsByOwner = async (req, res) => {
  try {
    if (req.user.id.toString() !== req.params.ownerId.toString())
      return res.status(403).json({ error: "Forbidden." });
    const result = await findSlotsByOwner(req.params.ownerId);
    console.log(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findActiveSlotsByOwner = async (req, res) => {
  try {
    const result = await findActiveSlotsByOwner(req.params.ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findSlotsByToken = async (req, res) => {
  try {
    const result = await findSlotByToken(req.params.token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findActiveOwners = async (req, res) => {
  try {
    const result = await findActiveOwners();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findReservationsByOwner = async (req, res) => {
  try {
    const result = await findReservationsByOwner(req.params.ownerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findReservationBySlot = async (req, res) => {
  try {
    const result = await findReservationBySlot(req.params.slotId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Invitation URL 
exports.getInviteUrl = async (req, res) => {
  try {
    const slot = await findSlotById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });
    // FIXED: use env var, fall back to request origin, never localhost
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const token   = slot.groupToken || slot.inviteToken;
    const url     = buildInviteUrl(baseUrl, token, slot.ownerId.toString());
    res.json({ inviteUrl: url, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Reservations (user) 
exports.reserveSlot = async (req, res) => {
  try {
    const { slotId } = req.body;
    const userId    = req.user.id;     // from JWT
    const userEmail = req.user.email;  // from JWT
    if (!slotId)
      return res.status(400).json({ error: "slotId is required." });

    const result = await reserveSlot(slotId, userId);

    // Build owner notification
    const slot  = await findSlotById(slotId);
    const db    = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
    const owner = await db.collection("users").findOne({ _id: new ObjectId(slot.ownerId) });
    const notifyOwner = slotReservedNotification(owner.email, slot, userEmail);

    res.json({ result, notifyOwner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const { reservationId } = req.body;
    const userId = req.user.id;  // from JWT
    if (!reservationId)
      return res.status(400).json({ error: "reservationId is required." });

    // Get details before cancelling so we can build the notification
    const details = await findReservationWithDetails(reservationId);
    if (!details) return res.status(404).json({ error: "Reservation not found." });

    const result = await cancelReservation(reservationId, userId);
    if (result.matchedCount === 0)
      return res.status(403).json({ error: "Reservation not found or you are not the booker." });

    const db    = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
    const owner = await db.collection("users").findOne({ _id: new ObjectId(details.slot.ownerId) });
    const notifyOwner = reservationCancelledNotification(owner.email, details.slot, details.user.email);

    res.json({ result, notifyOwner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.findReservationsByUser = async (req, res) => {
  try {
    if (req.user.id.toString() !== req.params.userId.toString())
      return res.status(403).json({ error: "Forbidden." });
    const result = await findReservationsByUser(req.params.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mailto helpers 
exports.userMessageToOwner = async (req, res) => {
  try {
    const slot  = await findSlotById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });
    const db    = require("../config/db").getDB();
    const { ObjectId } = require("mongodb");
    const owner = await db.collection("users").findOne({ _id: new ObjectId(slot.ownerId) });
    res.json({ mailto: buildUserToOwnerMailto(owner.email, slot) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.ownerMessageToBooker = async (req, res) => {
  try {
    const slot        = await findSlotById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });
    const reservation = await findReservationBySlot(req.params.slotId);
    if (!reservation) return res.status(404).json({ error: "No active reservation for this slot." });
    res.json({ mailto: buildOwnerToBookerMailto(reservation.user.email, slot) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportSlotICS = async (req, res) => {
  try {
    const slot = await findSlotById(req.params.slotId);
    if (!slot) return res.status(404).json({ error: "Slot not found." });

    const ics = buildICS([{
      title:       slot.title,
      start:       slot.startTime,
      end:         slot.endTime,
      description: `Booking slot managed via MyBookings`,
    }]);

    res.setHeader("Content-Type",        "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${slot.title}.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportReservationsICS = async (req, res) => {
  try {
    const reservations = await findReservationsByUser(req.params.userId);

    const events = reservations.map(r => ({
      title:       r.slot.title,
      start:       r.slot.startTime,
      end:         r.slot.endTime,
      description: `Booked via MyBookings with ${r.owner.name}`,
      organizer:   r.owner.email,
    }));

    const ics = buildICS(events);

    res.setHeader("Content-Type",        "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="my-bookings.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
