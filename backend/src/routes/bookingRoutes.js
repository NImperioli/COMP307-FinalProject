//Nicholas Imperioli - 261120345
const express = require("express");
const router = express.Router();
const controller = require("../controllers/bookingController");
const auth = require("../middleware/authMiddleware");

// TYPE 1 — Request Meeting
router.post("/request",                          auth.authenticateUserToken, controller.requestMeeting);
router.post("/respond",                          auth.authenticateOwnerToken, controller.respondToRequest);
router.get("/requests/user/:userId",             auth.authenticateUserToken, controller.getUserMeetingRequests);
router.get("/requests/owner/:ownerId",           auth.authenticateOwnerToken, controller.getOwnerMeetingRequests);
router.get("/requests/owner/:ownerId/pending",   auth.authenticateOwnerToken, controller.getOwnerPendingRequests);

// TYPE 2 — Group Meeting
router.post("/group/create",                     auth.authenticateOwnerToken, controller.createGroupMeeting);
router.post("/group/vote",                       auth.authenticateUserToken, controller.voteForSlots);
router.get("/group/:bookingId/votes",            auth.authenticateUserToken, controller.getSlotVoteCounts);
router.post("/group/finalize",                   auth.authenticateOwnerToken, controller.finalizeGroupMeeting);
router.get("/appointments/user/:userId",         auth.authenticateUserToken, controller.getUserAppointments);
router.get("/appointments/owner/:ownerId",       auth.authenticateOwnerToken, controller.getOwnerAppointments);

// TYPE 3 — Recurring Office Hours 
router.post("/office-hours/create",              auth.authenticateOwnerToken, controller.createOfficeHours);
router.post("/office-hours/reserve",             auth.authenticateUserToken,  controller.reserveOfficeHour);

module.exports = router;