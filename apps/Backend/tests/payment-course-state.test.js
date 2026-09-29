const assert = require("node:assert/strict");
const test = require("node:test");
const { deriveCoursePaymentStates } = require("../services/paymentCourseState");

const payment = (id, courseId, status) => ({ _id: id, courseId, status });
const state = (payments, enrolled = []) => deriveCoursePaymentStates(payments, new Set(enrolled));

test("a single rejected payment remains action-required", () => {
  assert.deepEqual(state([payment("a", "course-1", "rejected")]).get("a"), { kind: "action_required" });
});

test("only the newest unresolved rejected attempt can be action-required", () => {
  const states = state([payment("b", "course-1", "rejected"), payment("a", "course-1", "rejected")]);
  assert.deepEqual(states.get("a"), { kind: "newer_rejected", currentPaymentId: "b" });
  assert.deepEqual(states.get("b"), { kind: "action_required" });
});

test("all older rejected attempts point to the newest pending payment", () => {
  const states = state([payment("c", "course-1", "pending"), payment("b", "course-1", "rejected"), payment("a", "course-1", "rejected")]);
  assert.deepEqual(states.get("a"), { kind: "newer_pending", currentPaymentId: "c" });
  assert.deepEqual(states.get("b"), { kind: "newer_pending", currentPaymentId: "c" });
  assert.equal(states.has("c"), false);
});

test("enrollment resolves every historical rejected attempt but leaves approved payment normal", () => {
  const states = state([payment("c", "course-1", "approved"), payment("b", "course-1", "rejected"), payment("a", "course-1", "rejected")], ["course-1"]);
  assert.deepEqual(states.get("a"), { kind: "enrolled" });
  assert.deepEqual(states.get("b"), { kind: "enrolled" });
  assert.equal(states.has("c"), false);
});

test("payments for another course never supersede a rejected attempt", () => {
  const states = state([payment("b", "course-2", "pending"), payment("a", "course-1", "rejected")]);
  assert.deepEqual(states.get("a"), { kind: "action_required" });
});
