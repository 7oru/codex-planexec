import type { PolicyResult } from "./types.ts";

export type WritePolicy = {
  allowed_write_paths: string[];
  blocked_paths: string[];
};

export function evaluateWritePolicy(changedFiles: string[], policy: WritePolicy): PolicyResult {
  const violations: string[] = [];

  for (const file of changedFiles) {
    const normalized = normalizeGitPath(file);

    if (matchesAny(normalized, policy.blocked_paths)) {
      violations.push(`${normalized} matches blocked_paths`);
      continue;
    }

    if (!matchesAny(normalized, policy.allowed_write_paths)) {
      violations.push(`${normalized} is outside allowed_write_paths`);
    }
  }

  return {
    status: violations.length === 0 ? "passed" : "failed",
    violations,
  };
}

export function matchesAny(path: string, patterns: string[]): boolean {
  const normalized = normalizeGitPath(path);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

export function normalizeGitPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function globToRegExp(pattern: string): RegExp {
  const normalized = normalizeGitPath(pattern);
  let source = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`^${source}$`);
}

function escapeRegExp(char: string): string {
  return /[\\^$+?.()|[\]{}]/.test(char) ? `\\${char}` : char;
}
