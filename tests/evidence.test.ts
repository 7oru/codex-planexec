import assert from "node:assert/strict";
import test from "node:test";

import { selectDiffHunks } from "../src/evidence.ts";
import { DEFAULT_REVIEW_BUDGET } from "../src/task.ts";

const diff = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-old
+new
 context
@@ -10,2 +10,2 @@
-old2
+new2
 context2
diff --git a/src/b.ts b/src/b.ts
index 333..444 100644
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,1 +1,1 @@
-b
+bb
`;

test("selectDiffHunks returns selected hunks up to budget", () => {
  const hunks = selectDiffHunks(diff, {
    ...DEFAULT_REVIEW_BUDGET,
    max_diff_hunks: 2,
  });

  assert.equal(hunks.length, 2);
  assert.match(hunks[0], /diff --git a\/src\/a\.ts b\/src\/a\.ts/);
  assert.match(hunks[0], /@@ -1,2 \+1,2 @@/);
  assert.match(hunks[1], /@@ -10,2 \+10,2 @@/);
});

test("selectDiffHunks can include the full diff when explicitly budgeted", () => {
  const hunks = selectDiffHunks(diff, {
    ...DEFAULT_REVIEW_BUDGET,
    include_full_diff: true,
  });

  assert.deepEqual(hunks, [diff]);
});

test("selectDiffHunks returns empty list for empty diff or zero budget", () => {
  assert.deepEqual(selectDiffHunks("", DEFAULT_REVIEW_BUDGET), []);
  assert.deepEqual(
    selectDiffHunks(diff, {
      ...DEFAULT_REVIEW_BUDGET,
      max_diff_hunks: 0,
    }),
    [],
  );
});
