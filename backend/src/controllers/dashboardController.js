//William Borlase - 261143451
const slotModel = require("../models/slotModel")
// Dashboard behavior: get all info for an authenticated owner.

//
exports.ownerGetSlots = async (req, res) => {
  // Suggestion: Optimization could be to require start and end times when fetching slots
  // would make long term repeating slots practical
  // const {ownerId, minDate, maxDate} = req.body;
  const ownerId = req.body;

  const result = await slotModel.findSlotsByOwner(ownerId);
  res.json(result);
}

exports.ownerCreateSlots = async (req, res) => {
  const ownerId = req.owner;

  // can handle req as an array of slots or 1.
  if (req.slots){
    const result = [];
    for(let s in req.slots){
       result.append(await slotModel.createSlot(ownerId, [s.title, s.startTime, s.endTime]))
    }
    res.json(result);
  }
  else{
    // assume there is 1 slot
    const result = await slotModel.createSlot(ownerId, [req.title, req.startTime, req.endTime])
    res.json(result);
  }
}

exports.ownerDeleteSlots = async(req, res) => {
  // only delete 1 at a time!!
  const result = await slotModel.deleteSlot(req.slotId,req.owner);
  res.json(result);
}