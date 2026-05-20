import assert from "node:assert/strict";
import test from "node:test";

import { evaluateWritePolicy, matchesAny, normalizeGitPath } from "../src/policy.ts";

test("matchesAny supports exact paths, single-star, and double-star patterns", () => {
  assert.equal(matchesAny("src/index.ts", ["src/**"]), true);
  assert.equal(matchesAny("src/nested/index.ts", ["src/**"]), true);
  assert.equal(matchesAny(".env.local", [".env.*"]), true);
  assert.equal(matchesAny("tests/unit.test.ts", ["tests/*.test.ts"]), true);
  assert.equal(matchesAny("tests/nested/unit.test.ts", ["tests/*.test.ts"]), false);
});

test("normalizeGitPath removes leading dot slash and Windows separators", () => {
  assert.equal(normalizeGitPath("./src\\index.ts"), "src/index.ts");
});

test("evaluateWritePolicy passes allowed files", () => {
  const result = evaluateWritePolicy(["src/index.ts", "tests/policy.test.ts"], {
    allowed_write_paths: ["src/**", "tests/**"],
    blocked_paths: [".env", ".git/**"],
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.violations, []);
});

test("evaluateWritePolicy fails blocked files", () => {
  const result = evaluateWritePolicy([".env"], {
    allowed_write_paths: ["**"],
    blocked_paths: [".env", ".git/**"],
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.violations, [".env matches blocked_paths"]);
});

test("evaluateWritePolicy fails files outside allowlist", () => {
  const result = evaluateWritePolicy(["README.md"], {
    allowed_write_paths: ["src/**", "tests/**"],
    blocked_paths: [],
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.violations, ["README.md is outside allowed_write_paths"]);
});

test("evaluateWritePolicy gives blocked paths precedence over allowlist", () => {
  const result = evaluateWritePolicy(["package-lock.json"], {
    allowed_write_paths: ["**"],
    blocked_paths: ["package-lock.json"],
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.violations, ["package-lock.json matches blocked_paths"]);
});
