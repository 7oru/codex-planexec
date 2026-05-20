import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { createRunDirectory } from "../src/artifacts.ts";
import { DEFAULT_REVIEW_BUDGET } from "../src/task.ts";
import { compactFailureExcerpt, runValidationCommands } from "../src/validation.ts";

test("runValidationCommands returns skipped when no commands are configured", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-validation-"));

  try {
    const summary = await runValidationCommands({
      repo: root,
      runDir: root,
      commands: [],
      budget: DEFAULT_REVIEW_BUDGET,
    });

    assert.deepEqual(summary, {
      status: "skipped",
      failures: [],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runValidationCommands writes logs and passes successful commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-validation-"));

  try {
    const runDir = await createRunDirectory(join(root, "run"));
    const summary = await runValidationCommands({
      repo: root,
      runDir,
      commands: ["node -e \"console.log('ok')\""],
      budget: DEFAULT_REVIEW_BUDGET,
    });

    assert.equal(summary.status, "passed");
    assert.equal(await readFile(join(runDir, "validation-01.stdout.log"), "utf8"), "ok\n");
    assert.equal(await readFile(join(runDir, "validation-01.stderr.log"), "utf8"), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runValidationCommands stops on first failure and stores compact excerpt", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-validation-"));

  try {
    const runDir = await createRunDirectory(join(root, "run"));
    const summary = await runValidationCommands({
      repo: root,
      runDir,
      commands: ["node -e \"console.error('bad'); process.exit(1)\"", "node -e \"console.log('never')\""],
      budget: {
        ...DEFAULT_REVIEW_BUDGET,
        max_log_excerpt_chars: 20,
      },
    });

    assert.equal(summary.status, "failed");
    assert.deepEqual(summary.failures, [
      {
        command: "node -e \"console.error('bad'); process.exit(1)\"",
        excerpt: "bad",
      },
    ]);
    await assert.rejects(() => readFile(join(runDir, "validation-02.stdout.log"), "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("compactFailureExcerpt truncates long combined logs", () => {
  const excerpt = compactFailureExcerpt(
    {
      command: "demo",
      exitCode: 1,
      stdout: "a".repeat(100),
      stderr: "",
      durationMs: 1,
    },
    24,
  );

  assert.equal(excerpt, "aaaaaaaaa\n...[truncated]");
});
