import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { createRunDirectory, createRunId, resolveInside, writeJsonArtifact, writeTextArtifact } from "../src/artifacts.ts";

test("createRunId combines sortable timestamp and safe task id", () => {
  const id = createRunId("Implement Task #42", new Date("2026-05-20T01:02:03.456Z"));

  assert.equal(id, "2026-05-20T010203456Z-implement-task-42");
});

test("createRunDirectory creates an absolute directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-artifacts-"));

  try {
    const runDir = await createRunDirectory(join(root, "runs", "demo"));
    assert.equal(runDir.startsWith(root), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeTextArtifact and writeJsonArtifact write inside the run directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-artifacts-"));

  try {
    await writeTextArtifact(root, "stdout.log", "hello");
    await writeJsonArtifact(root, "review.json", { status: "accepted_candidate" });

    assert.equal(await readFile(join(root, "stdout.log"), "utf8"), "hello");
    assert.equal(await readFile(join(root, "review.json"), "utf8"), '{\n  "status": "accepted_candidate"\n}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolveInside rejects paths that escape the run directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-artifacts-"));

  try {
    assert.throws(() => resolveInside(root, "../outside.log"), /escapes run directory/);
    assert.throws(() => resolveInside(root, "/tmp/outside.log"), /escapes run directory/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
