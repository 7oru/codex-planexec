import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { runGit } from "../src/git.ts";
import { runHarness } from "../src/runner.ts";

test("runHarness writes preflight artifacts and compressed review packet", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-runner-"));

  try {
    assert.equal((await runGit(root, ["init"])).exitCode, 0);
    await writeFile(
      join(root, "task.json"),
      JSON.stringify({
        id: "demo",
        goal: "Implement demo.",
        instructions: "Only touch src.",
        allowed_write_paths: ["src/**"],
      }),
      "utf8",
    );

    const runDir = join(root, ".codex-planexec", "runs", "demo");
    const review = await runHarness({
      taskPath: join(root, "task.json"),
      repo: root,
      out: runDir,
    });

    assert.equal(review.status, "blocked");
    assert.equal(review.worker_report, "BLOCKED: worker execution is not implemented yet.");
    assert.deepEqual(review.changed_files, [
      {
        path: "task.json",
        additions: 0,
        deletions: 0,
        summary: "Changed file detected by git status.",
      },
    ]);
    assert.match(await readFile(join(runDir, "worker-prompt.md"), "utf8"), /You are an execution worker/);
    assert.match(await readFile(join(runDir, "review.json"), "utf8"), /compressed review packet|worker execution is not implemented yet/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
