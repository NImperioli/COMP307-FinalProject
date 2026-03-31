/**
 * testDB.js — Full test suite for slotModel, reservationModel, notificationService
 *
 * Run from the backend/ folder:
 *   node src/testDB.js
 *
 * All test data is cleaned up automatically after each run.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { connectDB, getDB }                      = require("./config/db");
const { createUser }                            = require("./models/userModel");
const {
  createSlot, createRecurringSlots,
  activateSlot, activateSlotsByGroup,
  deactivateSlot, deleteSlot, deleteSlotsByGroup,
  findActiveSlotsByOwner, findSlotByToken,
  findSlotById, findSlotsByGroup, findActiveOwners,
}                                               = require("./models/slotModel");
const {
  reserveSlot, cancelReservation,
  findReservationBySlot, findReservationsByOwner,
  findReservationsByUser, findReservationWithDetails,
}                                               = require("./models/reservationModel");
const {
  slotDeletedNotification, recurringGroupDeletedNotification,
  ownerMessageToBooker, reservationCancelledNotification,
  slotReservedNotification, userMessageToOwner, buildInviteUrl,
}                                               = require("./services/notificationService");

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const TEST_EMAILS = ["t.owner@mcgill.ca", "t.student@mail.mcgill.ca"];

function assert(label, condition, extra = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${extra ? " — " + extra : ""}`);
    failed++;
  }
}

async function assertThrows(label, fn) {
  try {
    await fn();
    console.error(`  ❌ ${label} — expected an error but none was thrown`);
    failed++;
  } catch {
    console.log(`  ✅ ${label}`);
    passed++;
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setupUsers() {
  const db = getDB();
  await db.collection("users").deleteMany({ email: { $in: TEST_EMAILS } });

  const ownerRes = await createUser({ email: "t.owner@mcgill.ca",        name: "Test Owner"   });
  const stuRes   = await createUser({ email: "t.student@mail.mcgill.ca", name: "Test Student" });

  return {
    ownerId:      ownerRes.insertedId.toString(),
    ownerEmail:   "t.owner@mcgill.ca",
    studentId:    stuRes.insertedId.toString(),
    studentEmail: "t.student@mail.mcgill.ca",
  };
}

// ─── Single slot: activation & privacy ───────────────────────────────────────

async function testSingleSlot(ownerId) {
  console.log("\n📅 Single slot — activation & privacy");

  const res = await createSlot(ownerId, {
    title:     "Drop-in — Test",
    startTime: new Date("2026-10-01T09:00:00Z"),
    endTime:   new Date("2026-10-01T10:00:00Z"),
  });
  assert("single slot created",      !!res.insertedId);
  const slotId = res.insertedId.toString();

  const slot = await findSlotById(slotId);
  assert("starts as private",        slot?.status === "private");
  assert("type is single",           slot?.type   === "single");
  assert("invite token generated",   typeof slot?.inviteToken === "string" && slot.inviteToken.length > 0);

  const activeBefore = await findActiveSlotsByOwner(ownerId);
  assert("private slot hidden from active list", !activeBefore.some(s => s._id.toString() === slotId));

  const act = await activateSlot(slotId, ownerId);
  assert("activateSlot matched",     act.matchedCount  === 1);
  assert("activateSlot modified",    act.modifiedCount === 1);

  const activeAfter = await findActiveSlotsByOwner(ownerId);
  assert("slot visible after activation", activeAfter.some(s => s._id.toString() === slotId));

  const fake = await activateSlot(slotId, "000000000000000000000001");
  assert("wrong owner cannot activate", fake.matchedCount === 0);

  const deact = await deactivateSlot(slotId, ownerId);
  assert("deactivateSlot works",     deact.modifiedCount === 1);

  const afterDeact = await findActiveSlotsByOwner(ownerId);
  assert("slot hidden after deactivation", !afterDeact.some(s => s._id.toString() === slotId));

  await activateSlot(slotId, ownerId);

  const byToken = await findSlotByToken(slot.inviteToken);
  assert("findSlotByToken returns slot", byToken.some(s => s._id.toString() === slotId));

  return { slotId, inviteToken: slot.inviteToken };
}

// ─── Type 3: recurring office hours ───────────────────────────────────────────

async function testRecurringSlots(ownerId) {
  console.log("\n🔁 Type 3 — Recurring office hours");

  const weeklySlots = [
    {
      title:     "Office Hours – Monday",
      startTime: new Date("2026-09-07T14:00:00Z"),
      endTime:   new Date("2026-09-07T15:00:00Z"),
    },
    {
      title:     "Office Hours – Wednesday",
      startTime: new Date("2026-09-09T14:00:00Z"),
      endTime:   new Date("2026-09-09T15:00:00Z"),
    },
  ];
  const WEEKS = 3;

  const result = await createRecurringSlots(ownerId, weeklySlots, WEEKS);
  assert("correct slot count created",  result.insertedCount === weeklySlots.length * WEEKS);
  assert("groupToken returned",         typeof result.groupToken === "string");

  const { groupToken } = result;
  const groupSlots = await findSlotsByGroup(groupToken);

  assert("all slots start private",     groupSlots.every(s => s.status === "private"));
  assert("all slots have groupToken",   groupSlots.every(s => s.groupToken === groupToken));
  assert("weekNumbers assigned",        groupSlots.some(s => s.weekNumber === 1) && groupSlots.some(s => s.weekNumber === WEEKS));

  const monSlots = groupSlots
    .filter(s => s.title === "Office Hours – Monday")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  assert("Monday slot count matches weeks", monSlots.length === WEEKS);
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  assert("7-day gap between Monday occurrences",
    new Date(monSlots[1].startTime) - new Date(monSlots[0].startTime) === MS_PER_WEEK
  );

  const actGroup = await activateSlotsByGroup(groupToken, ownerId);
  assert("activateSlotsByGroup modified all", actGroup.modifiedCount === weeklySlots.length * WEEKS);

  const activeGroup = await findSlotsByGroup(groupToken);
  assert("all group slots now active",  activeGroup.every(s => s.status === "active"));

  const byGroupToken = await findSlotByToken(groupToken);
  assert("groupToken resolves all active slots", byGroupToken.length === weeklySlots.length * WEEKS);

  // Deactivate-while-reserved guard
  const { ObjectId } = require("mongodb");
  const db = getDB();
  const firstSlotId = groupSlots[0]._id.toString();
  const tmpRes = await db.collection("reservations").insertOne({
    slotId:     new ObjectId(firstSlotId),
    userId:     new ObjectId("000000000000000000000002"),
    reservedAt: new Date(),
  });
  await assertThrows("cannot deactivate slot with active reservation", () =>
    deactivateSlot(firstSlotId, ownerId)
  );
  await db.collection("reservations").deleteOne({ _id: tmpRes.insertedId });

  // deleteSlotsByGroup skips reserved slots
  const tmpRes2 = await db.collection("reservations").insertOne({
    slotId:     new ObjectId(firstSlotId),
    userId:     new ObjectId("000000000000000000000002"),
    reservedAt: new Date(),
  });
  const delResult = await deleteSlotsByGroup(groupToken, ownerId);
  assert("deleteSlotsByGroup deletes unreserved", delResult.deletedCount === weeklySlots.length * WEEKS - 1);
  assert("deleteSlotsByGroup skips reserved",     delResult.skippedIds.length === 1);
  assert("skipped ID matches reserved slot",      delResult.skippedIds[0].toString() === firstSlotId);

  // Clean up remaining reserved slot + reservation
  await db.collection("reservations").deleteOne({ _id: tmpRes2.insertedId });
  await db.collection("slots").deleteOne({ _id: new ObjectId(firstSlotId) });
}

// ─── Reservation model ────────────────────────────────────────────────────────

async function testReservations(ownerId, ownerEmail, studentId, studentEmail, slotId) {
  console.log("\n🎟️  Reservation model");

  const { ObjectId } = require("mongodb");
  const db = getDB();

  // Cannot reserve a private slot
  await db.collection("slots").updateOne({ _id: new ObjectId(slotId) }, { $set: { status: "private" } });
  await assertThrows("cannot reserve a private slot", () => reserveSlot(slotId, studentId));
  await db.collection("slots").updateOne({ _id: new ObjectId(slotId) }, { $set: { status: "active" } });

  // Reserve
  const resRes = await reserveSlot(slotId, studentId);
  assert("reservation created",            !!resRes.insertedId);
  const reservationId = resRes.insertedId.toString();

  // Double-booking blocked
  await assertThrows("double-booking blocked", () => reserveSlot(slotId, studentId));

  // findReservationBySlot
  const bySlot = await findReservationBySlot(slotId);
  assert("findReservationBySlot returns doc",    !!bySlot);
  assert("booker email joined",                  bySlot?.user?.email === studentEmail);

  // findReservationsByOwner
  const byOwner = await findReservationsByOwner(ownerId);
  assert("findReservationsByOwner returns docs", byOwner.length > 0);
  assert("owner result has slot title",          !!byOwner[0]?.slot?.title);
  assert("owner result has user email",          !!byOwner[0]?.user?.email);

  // findReservationsByUser
  const byUser = await findReservationsByUser(studentId);
  assert("findReservationsByUser returns docs",  byUser.length > 0);
  assert("user result has slot title",           byUser[0]?.slot?.title === "Drop-in — Test");
  assert("user result has owner email",          !!byUser[0]?.owner?.email);

  // findReservationWithDetails
  const details = await findReservationWithDetails(reservationId);
  assert("details has slot",                     !!details?.slot?.title);
  assert("details has user email",               !!details?.user?.email);

  // Wrong user cannot cancel
  const wrongCancel = await cancelReservation(reservationId, ownerId);
  assert("wrong user cannot cancel",             wrongCancel.matchedCount === 0);

  // Correct user cancels
  const cancelled = await cancelReservation(reservationId, studentId);
  assert("cancellation matched",                 cancelled.matchedCount  === 1);
  assert("cancellation modified",                cancelled.modifiedCount === 1);

  // Slot free again
  const afterCancel = await findReservationBySlot(slotId);
  assert("slot free after cancellation",         afterCancel === null);

  // Cannot cancel twice
  const doubleCancel = await cancelReservation(reservationId, studentId);
  assert("cannot cancel twice",                  doubleCancel.matchedCount === 0);
}

// ─── findActiveOwners ─────────────────────────────────────────────────────────

async function testFindActiveOwners(ownerEmail) {
  console.log("\n🔍 findActiveOwners");

  const owners = await findActiveOwners();
  assert("owner with active slot in results", owners.some(o => o.email === ownerEmail));
  assert("all results are owners",            owners.every(o => o.role === "owner"));
}

// ─── Notification service ─────────────────────────────────────────────────────

async function testNotifications(ownerEmail, studentEmail, slotId) {
  console.log("\n📧 Notification service");

  const slot = await findSlotById(slotId);

  const del = slotDeletedNotification(studentEmail, slot);
  assert("slotDeletedNotification is mailto",       del.startsWith("mailto:"));
  assert("slotDeletedNotification targets booker",  del.includes(studentEmail));

  const recDel = recurringGroupDeletedNotification(studentEmail, [slot]);
  assert("recurringGroupDeleted is mailto",         recDel.startsWith("mailto:"));
  assert("recurringGroupDeleted includes title",    recDel.includes(encodeURIComponent(slot.title)));

  const ownerMsg = ownerMessageToBooker(studentEmail, slot);
  assert("ownerMessageToBooker is mailto",          ownerMsg.startsWith("mailto:"));
  assert("ownerMessageToBooker targets student",    ownerMsg.includes(studentEmail));

  const canc = reservationCancelledNotification(ownerEmail, slot, studentEmail);
  assert("reservationCancelled is mailto",          canc.startsWith("mailto:"));
  assert("reservationCancelled targets owner",      canc.includes(ownerEmail));

  const booked = slotReservedNotification(ownerEmail, slot, studentEmail);
  assert("slotReservedNotification is mailto",      booked.startsWith("mailto:"));
  assert("slotReservedNotification targets owner",  booked.includes(ownerEmail));

  const userMsg = userMessageToOwner(ownerEmail, slot);
  assert("userMessageToOwner is mailto",            userMsg.startsWith("mailto:"));
  assert("userMessageToOwner targets owner",        userMsg.includes(ownerEmail));

  const url = buildInviteUrl("https://myapp.com", "test-token-abc");
  assert("buildInviteUrl contains token",           url.includes("test-token-abc"));
  assert("buildInviteUrl contains /book",           url.includes("/book"));
}

// ─── Slot deletion ────────────────────────────────────────────────────────────

async function testSlotDeletion(ownerId, slotId) {
  console.log("\n🗑️  Slot deletion");

  const wrong = await deleteSlot(slotId, "000000000000000000000001");
  assert("wrong owner cannot delete",  wrong.deletedCount === 0);

  const good = await deleteSlot(slotId, ownerId);
  assert("owner can delete own slot",  good.deletedCount === 1);

  const gone = await findSlotById(slotId);
  assert("slot gone after deletion",   gone === null);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup(ownerId, studentId) {
  const db = getDB();
  const { ObjectId } = require("mongodb");

  const userOids = [ownerId, studentId].filter(Boolean).map(id => new ObjectId(id));
  await db.collection("slots").deleteMany({ ownerId: { $in: userOids } });
  await db.collection("reservations").deleteMany({ userId: { $in: userOids } });
  await db.collection("users").deleteMany({ email: { $in: TEST_EMAILS } });

  console.log("\n  🧹 Test data cleaned up");
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("🔌 Connecting to MongoDB...");
  try {
    await connectDB();
    console.log("✅ Connected");
  } catch (err) {
    console.error("❌ Could not connect:", err.message);
    process.exit(1);
  }

  let ownerId, studentId;

  try {
    const users = await setupUsers();
    ({ ownerId, studentId } = users);
    const { ownerEmail, studentEmail } = users;

    const { slotId } = await testSingleSlot(ownerId);
    await testRecurringSlots(ownerId);
    await testReservations(ownerId, ownerEmail, studentId, studentEmail, slotId);
    await testFindActiveOwners(ownerEmail);
    await testNotifications(ownerEmail, studentEmail, slotId);
    await testSlotDeletion(ownerId, slotId);
  } catch (err) {
    console.error("\n💥 Unexpected error:", err);
  } finally {
    await cleanup(ownerId, studentId);
  }

  console.log("\n─────────────────────────────────────");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("─────────────────────────────────────\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
