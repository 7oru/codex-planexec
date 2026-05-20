import type { ReviewBudget } from "./types.ts";

export function filterDiffByPaths(diff: string, paths: string[]): string {
  if (diff.trim() === "" || paths.length === 0) {
    return "";
  }

  const allowedPaths = new Set(paths);
  const sections: string[] = [];
  let current: string[] | null = null;
  let currentPath: string | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current && currentPath && allowedPaths.has(currentPath)) {
        sections.push(current.join("\n").trimEnd());
      }

      current = [line];
      currentPath = parseDiffPath(line);
      continue;
    }

    if (current) {
      current.push(line);
    }
  }

  if (current && currentPath && allowedPaths.has(currentPath)) {
    sections.push(current.join("\n").trimEnd());
  }

  return sections.join("\n");
}

export function selectDiffHunks(diff: string, budget: ReviewBudget): string[] {
  if (budget.include_full_diff) {
    return diff.trim() ? [diff] : [];
  }

  if (budget.max_diff_hunks <= 0 || diff.trim() === "") {
    return [];
  }

  const hunks: string[] = [];
  let currentFileHeader = "";
  let currentHunk: string[] | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      currentFileHeader = line;
      continue;
    }

    if (line.startsWith("@@ ")) {
      if (currentHunk) {
        hunks.push(currentHunk.join("\n"));
      }
      currentHunk = currentFileHeader ? [currentFileHeader, line] : [line];
      continue;
    }

    if (currentHunk) {
      currentHunk.push(line);
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk.join("\n"));
  }

  return hunks.slice(0, budget.max_diff_hunks);
}

function parseDiffPath(line: string): string | null {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return match ? match[2] : null;
}
