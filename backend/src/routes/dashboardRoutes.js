// William Borlase
// 261143451
const express = require("express");
const router = express.Router();
const controller = require("../controllers/dashboardController");

router.post("/dashboard/view", controller.ownerGetSlots);
router.post("/dashboard/create", controller.ownerCreateSlots);
router.post("/dashboard/delete", controller.ownerDeleteSlots);

module.exports = router;