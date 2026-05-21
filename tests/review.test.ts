import assert from "node:assert/strict";
import test from "node:test";

import { calculateReviewStatus, createEmptyReviewPacket, isWorkerBlockedOutput } from "../src/review.ts";
import type { PolicyResult, ValidationSummary, WorkerResult } from "../src/types.ts";

const passingPolicy: PolicyResult = {
  status: "passed",
  violations: [],
};

const passingValidation: ValidationSummary = {
  status: "passed",
  failures: [],
};

const passingWorker: WorkerResult = {
  exit_code: 0,
  timed_out: false,
};

test("calculateReviewStatus returns blocked for explicit worker block", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "BLOCKED: missing dependency",
      worker: passingWorker,
      policy: passingPolicy,
      validation: passingValidation,
    }),
    "blocked",
  );
});

test("calculateReviewStatus accepts legacy BLOCKED without colon", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "BLOCKED missing dependency",
      worker: passingWorker,
      policy: passingPolicy,
      validation: passingValidation,
    }),
    "blocked",
  );
});

test("calculateReviewStatus rejects policy violations before worker block", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "BLOCKED: after touching a blocked file",
      worker: passingWorker,
      policy: {
        status: "failed",
        violations: [".env matches blocked_paths"],
      },
      validation: passingValidation,
    }),
    "rejected",
  );
});

test("calculateReviewStatus rejects policy violations", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "",
      worker: passingWorker,
      policy: {
        status: "failed",
        violations: ["package-lock.json is blocked"],
      },
      validation: passingValidation,
    }),
    "rejected",
  );
});

test("calculateReviewStatus requests fixes for failed validation", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "",
      worker: passingWorker,
      policy: passingPolicy,
      validation: {
        status: "failed",
        failures: [{ command: "npm test", excerpt: "Expected rejected, received needs_fix." }],
      },
    }),
    "needs_fix",
  );
});

test("calculateReviewStatus accepts clean candidate", () => {
  assert.equal(
    calculateReviewStatus({
      workerOutput: "",
      worker: passingWorker,
      policy: passingPolicy,
      validation: passingValidation,
    }),
    "accepted_candidate",
  );
});

test("isWorkerBlockedOutput detects only explicit blocked reports", () => {
  assert.equal(isWorkerBlockedOutput("BLOCKED: missing dependency"), true);
  assert.equal(isWorkerBlockedOutput("BLOCKED missing dependency"), true);
  assert.equal(isWorkerBlockedOutput("BLOCKED"), true);
  assert.equal(isWorkerBlockedOutput("BLOCKED_BY_TEST"), false);
  assert.equal(isWorkerBlockedOutput("implemented without blocker"), false);
});

test("createEmptyReviewPacket uses artifact paths instead of embedded logs", () => {
  const packet = createEmptyReviewPacket("accepted_candidate");

  assert.equal(packet.artifacts.diff, "diff.patch");
  assert.equal(packet.artifacts.stdout, "stdout.log");
  assert.equal(packet.artifacts.stderr, "stderr.log");
  assert.deepEqual(packet.selected_diff_hunks, []);
  assert.deepEqual(packet.warnings, []);
});
