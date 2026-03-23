/**
 * testDB.js — Tests for userModel, slotModel, reservationModel, notificationService
 *
 * Run from the backend/ folder:
 *   node src/testDB.js
 *
 * Cleans up all inserted test data after each run automatically.
 */

//MADE BY AI CANT BE ASKED TO MAKE MY OWN

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { connectDB, getDB } = require("./config/db");
const { createUser, findUserByEmail, findUserById, findActiveOwners, getRoleFromEmail } = require("./models/userModel");
const { createSlot, activateSlot, deleteSlot, findSlotsByOwner, findActiveSlotsByOwner, findSlotByToken, findSlotById } = require("./models/slotModel");
const { reserveSlot, cancelReservation, findReservationsByUser, findReservationBySlot, findReservationWithDetails } = require("./models/reservationModel");

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const createdUserIds = [];
const createdSlotIds = [];

function assert(label, condition, extra = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${extra ? " — " + extra : ""}`);
    failed++;
  }
}

function assertThrows(label, fn) {
  return fn().then(() => {
    console.error(`  ❌ ${label} — expected an error but none was thrown`);
    failed++;
  }).catch(() => {
    console.log(`  ✅ ${label}`);
    passed++;
  });
}

// ─── User model ───────────────────────────────────────────────────────────────

async function testUsers() {
  console.log("\n👤 User model");

  // Role detection from email domain
  assert("@mcgill.ca → owner",        getRoleFromEmail("prof@mcgill.ca") === "owner");
  assert("@mail.mcgill.ca → student", getRoleFromEmail("stu@mail.mcgill.ca") === "student");
  assert("@gmail.com → null",         getRoleFromEmail("x@gmail.com") === null);

  // Create owner
  const ownerRes = await createUser({ email: "test.owner@mcgill.ca", name: "Test Owner" });
  assert("owner inserted", !!ownerRes.insertedId);
  createdUserIds.push(ownerRes.insertedId);

  // Create student
  const stuRes = await createUser({ email: "test.student@mail.mcgill.ca", name: "Test Student" });
  assert("student inserted", !!stuRes.insertedId);
  createdUserIds.push(stuRes.insertedId);

  // Reject non-McGill email
  await assertThrows("non-McGill email rejected", () =>
    createUser({ email: "someone@gmail.com", name: "Outsider" })
  );

  // Reject duplicate email
  await assertThrows("duplicate email rejected", () =>
    createUser({ email: "test.owner@mcgill.ca", name: "Duplicate" })
  );

  // findUserByEmail
  const found = await findUserByEmail("test.owner@mcgill.ca");
  assert("findUserByEmail returns correct doc", found?.email === "test.owner@mcgill.ca");
  assert("owner role stored correctly",         found?.role === "owner");

  // findUserById
  const byId = await findUserById(ownerRes.insertedId.toString());
  assert("findUserById returns correct doc", byId?.name === "Test Owner");

  return {
    ownerId:      ownerRes.insertedId.toString(),
    ownerEmail:   "test.owner@mcgill.ca",
    studentId:    stuRes.insertedId.toString(),
    studentEmail: "test.student@mail.mcgill.ca",
  };
}

// ─── Slot model ───────────────────────────────────────────────────────────────

async function testSlots(ownerId) {
  console.log("\n📅 Slot model");

  const slotData = {
    title:     "Office Hours - Test",
    startTime: new Date("2026-09-01T10:00:00Z"),
    endTime:   new Date("2026-09-01T11:00:00Z"),
  };

  // Create — starts private
  const slotRes = await createSlot(ownerId, slotData);
  assert("slot created", !!slotRes.insertedId);
  createdSlotIds.push(slotRes.insertedId);
  const slotId = slotRes.insertedId.toString();

  const slot = await findSlotById(slotId);
  assert("slot starts as private",          slot?.status === "private");
  assert("invite token generated",          typeof slot?.inviteToken === "string" && slot.inviteToken.length > 0);

  // findSlotsByOwner includes private slots
  const ownerSlots = await findSlotsByOwner(ownerId);
  assert("findSlotsByOwner includes private slot", ownerSlots.some(s => s._id.toString() === slotId));

  // findActiveSlotsByOwner excludes private slots
  const activeBefore = await findActiveSlotsByOwner(ownerId);
  assert("private slot excluded from active list", !activeBefore.some(s => s._id.toString() === slotId));

  // Activate
  const activated = await activateSlot(slotId, ownerId);
  assert("slot activated (matched)",  activated.matchedCount === 1);
  assert("slot activated (modified)", activated.modifiedCount === 1);

  // Now visible in active list
  const activeAfter = await findActiveSlotsByOwner(ownerId);
  assert("slot appears in active list after activation", activeAfter.some(s => s._id.toString() === slotId));

  // findSlotByToken
  const byToken = await findSlotByToken(slot.inviteToken);
  assert("findSlotByToken returns correct slot", byToken.length > 0 && byToken[0]._id.toString() === slotId);

  // Owner guard — wrong owner cannot modify
  const fakeOwnerId = "000000000000000000000001";
  const guardCheck  = await activateSlot(slotId, fakeOwnerId);
  assert("wrong owner cannot modify slot", guardCheck.matchedCount === 0);

  return { slotId, inviteToken: slot.inviteToken };
}

// ─── Reservation model ────────────────────────────────────────────────────────

async function testReservations(ownerId, studentId, slotId) {
  console.log("\n🎟️  Reservation model");

  // Reserve slot
  const resRes = await reserveSlot(slotId, studentId);
  assert("reservation created", !!resRes.insertedId);
  const reservationId = resRes.insertedId.toString();

  // Double-booking must throw
  await assertThrows("double-booking blocked", () =>
    reserveSlot(slotId, ownerId)
  );

  // findReservationBySlot — owner sees who booked
  const bySlot = await findReservationBySlot(slotId);
  assert("findReservationBySlot returns booker email", bySlot?.user?.email === "test.student@mail.mcgill.ca");

  // findReservationsByUser — student's "my bookings" view
  const byUser = await findReservationsByUser(studentId);
  assert("findReservationsByUser returns booking",    byUser.length > 0);
  assert("booking includes slot title",               byUser[0]?.slot?.title === "Office Hours - Test");
  assert("booking includes owner email",              !!byUser[0]?.owner?.email);

  // findReservationWithDetails — used for building notification links
  const details = await findReservationWithDetails(reservationId);
  assert("findReservationWithDetails has slot", !!details?.slot?.title);
  assert("findReservationWithDetails has user", !!details?.user?.email);

  // Cancel reservation
  const cancelled = await cancelReservation(reservationId, studentId);
  assert("reservation cancelled (matched)",  cancelled.matchedCount === 1);
  assert("reservation cancelled (modified)", cancelled.modifiedCount === 1);

  // Slot is free again after cancellation
  const afterCancel = await findReservationBySlot(slotId);
  assert("slot is free after cancellation", afterCancel === null);

  // Wrong user cannot cancel someone else's reservation
  const reRes2   = await reserveSlot(slotId, studentId);
  const rid2     = reRes2.insertedId.toString();
  const wrongCancel = await cancelReservation(rid2, ownerId);
  assert("wrong user cannot cancel reservation", wrongCancel.matchedCount === 0);
}

// ─── findActiveOwners ─────────────────────────────────────────────────────────

async function testFindActiveOwners(ownerEmail) {
  console.log("\n🔍 findActiveOwners");

  const owners = await findActiveOwners();
  assert("owner with active slot in list",  owners.some(o => o.email === ownerEmail));
  assert("all results have owner role",     owners.every(o => o.role === "owner"));
}

// ─── Slot deletion with owner guard ──────────────────────────────────────────

async function testSlotDeletion(ownerId, slotId) {
  console.log("\n🗑️  Slot deletion");

  const fakeOwnerId = "000000000000000000000001";
  const badDelete   = await deleteSlot(slotId, fakeOwnerId);
  assert("wrong owner cannot delete slot", badDelete.deletedCount === 0);

  const goodDelete = await deleteSlot(slotId, ownerId);
  assert("owner can delete own slot", goodDelete.deletedCount === 1);

  const gone = await findSlotById(slotId);
  assert("slot gone after deletion", gone === null);

  createdSlotIds.length = 0; // already deleted, skip cleanup
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  const db = getDB();
  const { ObjectId } = require("mongodb");

  if (createdSlotIds.length > 0) {
    await db.collection("slots").deleteMany({
      _id: { $in: createdSlotIds.map(id => new ObjectId(id)) }
    });
  }

  if (createdUserIds.length > 0) {
    const userOids = createdUserIds.map(id => new ObjectId(id));
    await db.collection("reservations").deleteMany({ userId: { $in: userOids } });
    await db.collection("users").deleteMany({ _id: { $in: userOids } });
  }

  console.log("\n  🧹 Test data cleaned up");
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("🔌 Connecting to MongoDB...");
  try {
    await connectDB();
    console.log("✅ Connected");
  } catch (err) {
    console.error("❌ Could not connect to MongoDB:", err.message);
    process.exit(1);
  }

  try {
    const { ownerId, ownerEmail, studentId, studentEmail } = await testUsers();
    const { slotId } = await testSlots(ownerId);
    await testReservations(ownerId, studentId, slotId);
    await testFindActiveOwners(ownerEmail);
    await testSlotDeletion(ownerId, slotId);
  } catch (err) {
    console.error("\n💥 Unexpected error:", err);
  } finally {
    await cleanup();
  }

  console.log("\n─────────────────────────────────────");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("─────────────────────────────────────\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();