//Nicholas Imperioli - 261120345
const bookingService = require("../services/bookingService");

// TYPE 1
exports.requestMeeting = async (req, res) => {
  const { userId, ownerId, message } = req.body;

  const result = await bookingService.requestMeeting(userId, ownerId, message);
  res.json(result);
};

exports.respondToRequest = async (req, res) => {
  const { bookingId, accepted } = req.body;

  const result = await bookingService.respondToRequest(bookingId, accepted);
  res.json(result);
};

// TYPE 2
exports.createGroupSlots = async (req, res) => {
  const { ownerId, slots } = req.body;

  const result = await bookingService.createGroupSlots(ownerId, slots);
  res.json(result);
};

exports.voteSlot = async (req, res) => {
  const { bookingId, userId, slotTime } = req.body;

  const result = await bookingService.voteSlot(bookingId, userId, slotTime);
  res.json(result);
};

exports.finalizeGroupMeeting = async (req, res) => {
  const { bookingId, selectedTime, repeatWeeks } = req.body;

  const result = await bookingService.finalizeGroupMeeting(
    bookingId,
    selectedTime,
    repeatWeeks
  );
  res.json(result);
};

// TYPE 3
exports.createOfficeHours = async (req, res) => {
  const { ownerId, slots, weeks } = req.body;

  const result = await bookingService.createOfficeHours(ownerId, slots, weeks);
  res.json(result);
};

exports.reserveOfficeHour = async (req, res) => {
  const { bookingId, slotTime, userId } = req.body;

  const result = await bookingService.reserveOfficeHour(
    bookingId,
    slotTime,
    userId
  );
  res.json(result);
};

// William Borlase - 261143451