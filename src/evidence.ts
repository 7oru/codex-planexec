import type { ReviewBudget } from "./types.ts";

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
