//Nicholas Imperioli - 261120345
const express = require("express");
const router = express.Router();
const controller = require("../controllers/bookingController");

// TYPE 1 — Request Meeting
router.post("/request",                          controller.requestMeeting);
router.post("/respond",                          controller.respondToRequest);
router.get("/requests/user/:userId",             controller.getUserMeetingRequests);
router.get("/requests/owner/:ownerId",           controller.getOwnerMeetingRequests);
router.get("/requests/owner/:ownerId/pending",   controller.getOwnerPendingRequests);

// TYPE 2 — Group Meeting
router.post("/group/create",                     controller.createGroupMeeting);
router.post("/group/vote",                       controller.voteForSlots);
router.get("/group/:bookingId/votes",            controller.getSlotVoteCounts);
router.post("/group/finalize",                   controller.finalizeGroupMeeting);
router.get("/appointments/user/:userId",         controller.getUserAppointments);
router.get("/appointments/owner/:ownerId",       controller.getOwnerAppointments);

// TYPE 3 — Office Hours
router.post("/office-hours/create",              controller.createOfficeHours);
router.post("/office-hours/reserve",             controller.reserveOfficeHour);

module.exports = router;