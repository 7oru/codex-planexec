import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { runGit } from "../src/git.ts";
import { runHarness } from "../src/runner.ts";

test("runHarness writes preflight artifacts and compressed review packet", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-runner-"));
  const repo = join(root, "repo");

  try {
    await mkdir(repo);
    assert.equal((await runGit(repo, ["init"])).exitCode, 0);
    const fakeKimi = join(root, "fake-kimi.mjs");
    await writeFile(
      fakeKimi,
      `#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
mkdirSync(join(process.cwd(), 'src'), { recursive: true });
writeFileSync(join(process.cwd(), 'src', 'generated.txt'), 'hello\\n');
console.log('implemented generated file');
`,
      "utf8",
    );
    await chmod(fakeKimi, 0o755);
    await writeFile(
      join(root, "task.json"),
      JSON.stringify({
        id: "demo",
        goal: "Implement demo.",
        instructions: "Only touch src.",
        allowed_write_paths: ["src/**"],
        worker: {
          kind: "kimi",
          command: fakeKimi,
          max_steps_per_turn: 20,
          extra_args: [],
        },
      }),
      "utf8",
    );

    const runDir = join(repo, ".codex-planexec", "runs", "demo");
    const review = await runHarness({
      taskPath: join(root, "task.json"),
      repo,
      out: runDir,
    });

    assert.equal(review.status, "accepted_candidate");
    assert.equal(review.worker_report, "implemented generated file");
    assert.deepEqual(review.changed_files, [
      {
        path: "src/generated.txt",
        additions: 0,
        deletions: 0,
        summary: "Changed file detected by git status.",
      },
    ]);
    assert.match(await readFile(join(runDir, "worker-prompt.md"), "utf8"), /You are an execution worker/);
    assert.match(await readFile(join(runDir, "review.json"), "utf8"), /implemented generated file/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
