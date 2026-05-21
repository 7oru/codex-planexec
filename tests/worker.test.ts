import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTaskSpec } from "../src/task.ts";
import { assertKimiInfoSucceeded, runKimiInfo, runKimiWorker } from "../src/worker.ts";

test("runKimiInfo invokes configured command with Kimi info args", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-worker-"));

  try {
    const fakeKimi = join(root, "fake-kimi.mjs");
    await writeFile(
      fakeKimi,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync('${join(root, "info-args.json")}', JSON.stringify(process.argv.slice(2)));
console.log('kimi info ok');
`,
      "utf8",
    );
    await chmod(fakeKimi, 0o755);

    const task = normalizeTaskSpec({
      id: "demo",
      goal: "Implement demo.",
      instructions: "Only touch src.",
      allowed_write_paths: ["src/**"],
      worker: {
        kind: "kimi",
        command: fakeKimi,
        max_steps_per_turn: 7,
        extra_args: ["--debug"],
      },
    });
    const result = await runKimiInfo({
      repo: root,
      task,
    });

    assertKimiInfoSucceeded(fakeKimi, result);
    assert.equal(result.stdout, "kimi info ok\n");
    assert.deepEqual(JSON.parse(await readFile(join(root, "info-args.json"), "utf8")), ["info"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("assertKimiInfoSucceeded rejects failed preflight results", () => {
  assert.throws(
    () =>
      assertKimiInfoSucceeded("kimi", {
        stdout: "",
        stderr: "not authenticated",
        worker: {
          exit_code: 2,
          timed_out: false,
        },
      }),
    /Kimi worker preflight failed: kimi info exited with code 2\nnot authenticated/,
  );
});

test("runKimiWorker invokes configured command with Kimi print-mode args", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-worker-"));

  try {
    const fakeKimi = join(root, "fake-kimi.mjs");
    await writeFile(
      fakeKimi,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync('${join(root, "args.json")}', JSON.stringify(process.argv.slice(2)));
console.log('worker ok');
`,
      "utf8",
    );
    await chmod(fakeKimi, 0o755);

    const task = normalizeTaskSpec({
      id: "demo",
      goal: "Implement demo.",
      instructions: "Only touch src.",
      allowed_write_paths: ["src/**"],
      worker: {
        kind: "kimi",
        command: fakeKimi,
        max_steps_per_turn: 7,
        extra_args: ["--debug"],
      },
    });
    const result = await runKimiWorker({
      repo: root,
      task,
      prompt: "hello worker",
    });

    assert.equal(result.worker.exit_code, 0);
    assert.equal(result.worker.timed_out, false);
    assert.equal(result.stdout, "worker ok\n");
    assert.deepEqual(JSON.parse(await readFile(join(root, "args.json"), "utf8")), [
      "--work-dir",
      root,
      "--print",
      "--quiet",
      "--afk",
      "--max-steps-per-turn",
      "7",
      "--debug",
      "-p",
      "hello worker",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
