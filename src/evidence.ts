import type { ReviewBudget } from "./types.ts";

export type DiffStat = {
  additions: number;
  deletions: number;
};

export function filterDiffByPaths(diff: string, paths: string[]): string {
  if (diff.trim() === "" || paths.length === 0) {
    return "";
  }

  const sections = splitDiffByPath(diff);

  return paths.map((path) => sections.get(path)).filter(Boolean).join("\n");
}

export function splitDiffByPath(diff: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string[] | null = null;
  let currentPath: string | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      storeDiffSection(sections, currentPath, current);

      current = [line];
      currentPath = parseDiffPath(line);
      continue;
    }

    if (current) {
      current.push(line);
    }
  }

  storeDiffSection(sections, currentPath, current);

  return sections;
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

export function countDiffStatsByPath(diff: string): Map<string, DiffStat> {
  const stats = new Map<string, DiffStat>();

  for (const [path, section] of splitDiffByPath(diff)) {
    let additions = 0;
    let deletions = 0;

    for (const line of section.split("\n")) {
      if (line.startsWith("+++") || line.startsWith("---")) {
        continue;
      }

      if (line.startsWith("+")) {
        additions += 1;
      } else if (line.startsWith("-")) {
        deletions += 1;
      }
    }

    stats.set(path, { additions, deletions });
  }

  return stats;
}

function parseDiffPath(line: string): string | null {
  const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  return match ? match[2] : null;
}

function storeDiffSection(sections: Map<string, string>, path: string | null, lines: string[] | null): void {
  if (!path || !lines) {
    return;
  }

  const section = lines.join("\n").trimEnd();

  if (section) {
    sections.set(path, section);
  }
}
