// Nicholas Imperioli - 261120345
const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/slotController");

// Owner: slot management 
router.post("/recurring",                          controller.createRecurringSlots);
router.post("/:slotId/activate",                   controller.activateSlot);
router.post("/group/:groupToken/activate",         controller.activateSlotsByGroup);
router.post("/:slotId/deactivate",                 controller.deactivateSlot);
router.delete("/:slotId",                          controller.deleteSlot);
router.delete("/group/:groupToken",                controller.deleteSlotsByGroup);

// Owner: queries 
router.get("/owners/active",                       controller.findActiveOwners);
router.get("/owner/:ownerId",                      controller.findSlotsByOwner);
router.get("/owner/:ownerId/active",               controller.findActiveSlotsByOwner);
router.get("/owner/:ownerId/reservations",         controller.findReservationsByOwner);
router.get("/:slotId/reservation",                 controller.findReservationBySlot);
router.get("/:slotId/invite-url",                  controller.getInviteUrl);

// Public: invite token lookup 
router.get("/token/:token",                        controller.findSlotsByToken);

// User: reservations 
router.post("/reserve",                            controller.reserveSlot);
router.post("/cancel",                             controller.cancelReservation);
router.get("/my-reservations/:userId",             controller.findReservationsByUser);

// Mailto helpers 
router.get("/:slotId/message-owner",               controller.userMessageToOwner);
router.get("/:slotId/message-booker",              controller.ownerMessageToBooker);

module.exports = router;
