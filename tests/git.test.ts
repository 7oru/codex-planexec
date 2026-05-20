import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { assertGitRepo, collectGitSnapshot, parsePorcelainStatusPaths, runGit } from "../src/git.ts";

test("parsePorcelainStatusPaths includes modified, untracked, and rename targets", () => {
  const paths = parsePorcelainStatusPaths(" M src/index.ts\n?? tests/new.test.ts\nR  old.ts -> src/new.ts\n");

  assert.deepEqual(paths, ["src/index.ts", "src/new.ts", "tests/new.test.ts"]);
});

test("assertGitRepo rejects non-repositories", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-not-git-"));

  try {
    await assert.rejects(() => assertGitRepo(root), /Not a Git worktree/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("collectGitSnapshot captures untracked files from git status", async () => {
  const root = await mkdtemp(join(tmpdir(), "planexec-git-"));

  try {
    assert.equal((await runGit(root, ["init"])).exitCode, 0);
    await writeFile(join(root, "README.md"), "# demo\n", "utf8");

    const snapshot = await collectGitSnapshot(root);

    assert.match(snapshot.status, /\?\? README\.md/);
    assert.deepEqual(snapshot.changedFiles, ["README.md"]);
    assert.match(snapshot.diff, /diff --git a\/README\.md b\/README\.md/);
    assert.match(snapshot.diff, /\+# demo/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
