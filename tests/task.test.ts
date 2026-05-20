import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_BLOCKED_PATHS, DEFAULT_REVIEW_BUDGET, DEFAULT_WORKER, normalizeTaskSpec } from "../src/task.ts";

test("normalizeTaskSpec fills MVP defaults", () => {
  const task = normalizeTaskSpec({
    id: "demo",
    goal: "Implement the change.",
    instructions: "Only touch source files.",
    allowed_write_paths: ["src/**"],
  });

  assert.deepEqual(task.blocked_paths, DEFAULT_BLOCKED_PATHS);
  assert.deepEqual(task.validation_commands, []);
  assert.deepEqual(task.review_budget, DEFAULT_REVIEW_BUDGET);
  assert.deepEqual(task.worker, DEFAULT_WORKER);
});

test("normalizeTaskSpec preserves supplied review budget overrides", () => {
  const task = normalizeTaskSpec({
    id: "demo",
    goal: "Implement the change.",
    instructions: "Only touch source files.",
    allowed_write_paths: ["src/**"],
    review_budget: {
      max_diff_hunks: 2,
      max_log_excerpt_chars: 1000,
      include_full_diff: true,
      include_full_stdout: false,
    },
  });

  assert.equal(task.review_budget.max_diff_hunks, 2);
  assert.equal(task.review_budget.max_log_excerpt_chars, 1000);
  assert.equal(task.review_budget.include_full_diff, true);
});

test("normalizeTaskSpec rejects missing required fields", () => {
  assert.throws(
    () =>
      normalizeTaskSpec({
        id: "demo",
        goal: "Implement the change.",
        instructions: "Only touch source files.",
      }),
    /allowed_write_paths/,
  );
});
