//Nicholas Imperioli - 261120345
const express = require("express");
const router = express.Router();
const controller = require("../controllers/bookingController");

// TYPE 1
router.post("/request", controller.requestMeeting);
router.post("/respond", controller.respondToRequest);

// TYPE 2
router.post("/group/create", controller.createGroupSlots);
router.post("/group/vote", controller.voteSlot);
router.post("/group/finalize", controller.finalizeGroupMeeting);

// TYPE 3
router.post("/office-hours/create", controller.createOfficeHours);
router.post("/office-hours/reserve", controller.reserveOfficeHour);

//William Borlase - 261143451
// Dashboard routing

//router.post("/dashboard/view", controller.viewSlots);

module.exports = router;