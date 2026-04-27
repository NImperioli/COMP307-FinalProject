// Nicholas Imperioli - 261120345
// William Borlase: token authentication - 261143451
const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/slotController");
const authToken = require("../middleware/authMiddleware");

// Owner: slot management
router.post("/create",                             authToken.authenticateOwnerToken, controller.createSlot); //wb
router.post("/recurring",                          authToken.authenticateOwnerToken, controller.createRecurringSlots);
router.post("/:slotId/activate",                   authToken.authenticateOwnerToken, controller.activateSlot);
router.post("/group/:groupToken/activate",         authToken.authenticateOwnerToken, controller.activateSlotsByGroup);
router.post("/:slotId/deactivate",                 authToken.authenticateOwnerToken, controller.deactivateSlot);
router.delete("/:slotId",                          authToken.authenticateOwnerToken, controller.deleteSlot);
router.delete("/group/:groupToken",                authToken.authenticateOwnerToken, controller.deleteSlotsByGroup);

// Owner: queries 
router.get("/owners/active",                       authToken.authenticateAnyToken, controller.findActiveOwners);
router.get("/owner/:ownerId",                      authToken.authenticateOwnerToken, controller.findSlotsByOwner);
router.get("/owner/:ownerId/active",               authToken.authenticateOwnerToken, controller.findActiveSlotsByOwner);
router.get("/owner/:ownerId/reservations",         authToken.authenticateOwnerToken, controller.findReservationsByOwner);
router.get("/:slotId/reservation",                 authToken.authenticateOwnerToken, controller.findReservationBySlot);
router.get("/:slotId/invite-url",                  authToken.authenticateOwnerToken, controller.getInviteUrl);

// Public: invite token lookup 
router.get("/token/:token",                        controller.findSlotsByToken);

// User: reservations 
router.post("/reserve",                            authToken.authenticateUserToken, controller.reserveSlot);
router.post("/cancel",                             authToken.authenticateUserToken, controller.cancelReservation);
router.get("/my-reservations/:userId",             authToken.authenticateUserToken, controller.findReservationsByUser);

// Mailto helpers 
router.get("/:slotId/message-owner",               authToken.authenticateUserToken, controller.userMessageToOwner);
router.get("/:slotId/message-booker",              authToken.authenticateOwnerToken, controller.ownerMessageToBooker);

router.get("/:slotId/export.ics",                  authToken.authenticateAnyToken, controller.exportSlotICS);
router.get("/my-reservations/:userId/export.ics",  authToken.authenticateUserToken, controller.exportReservationsICS);

module.exports = router;
