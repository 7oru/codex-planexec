import { spawn } from "node:child_process";

export type GitCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type GitSnapshot = {
  status: string;
  changedFiles: string[];
  diff: string;
};

export async function assertGitRepo(repo: string): Promise<void> {
  const result = await runGit(repo, ["rev-parse", "--is-inside-work-tree"]);

  if (result.exitCode !== 0 || result.stdout.trim() !== "true") {
    throw new Error(`Not a Git worktree: ${repo}`);
  }
}

export async function collectGitSnapshot(repo: string): Promise<GitSnapshot> {
  await assertGitRepo(repo);

  const status = await runGit(repo, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const diff = await collectTrackedDiff(repo);

  if (status.exitCode !== 0) {
    throw new Error(`Failed to read git status: ${status.stderr || status.stdout}`);
  }

  const untrackedDiff = await collectUntrackedDiff(repo, parseUntrackedStatusPaths(status.stdout));

  return {
    status: status.stdout,
    changedFiles: parsePorcelainStatusPaths(status.stdout),
    diff: joinDiffs([diff, untrackedDiff]),
  };
}

export function parsePorcelainStatusPaths(status: string): string[] {
  const paths = new Set<string>();

  for (const line of status.split("\n")) {
    if (line.trim() === "") {
      continue;
    }

    const rawPath = line.slice(3);
    const renameSeparatorIndex = rawPath.lastIndexOf(" -> ");

    if (renameSeparatorIndex === -1) {
      paths.add(unquoteGitPath(rawPath));
      continue;
    }

    paths.add(unquoteGitPath(rawPath.slice(0, renameSeparatorIndex)));
    paths.add(unquoteGitPath(rawPath.slice(renameSeparatorIndex + " -> ".length)));
  }

  return [...paths].sort();
}

export function runGit(repo: string, args: string[]): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: repo,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function parseUntrackedStatusPaths(status: string): string[] {
  const paths: string[] = [];

  for (const line of status.split("\n")) {
    if (line.startsWith("?? ")) {
      paths.push(unquoteGitPath(line.slice(3)));
    }
  }

  return paths;
}

async function collectTrackedDiff(repo: string): Promise<string> {
  if (await hasGitHead(repo)) {
    const result = await runGit(repo, ["diff", "--binary", "HEAD"]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read git diff: ${result.stderr || result.stdout}`);
    }

    return result.stdout;
  }

  const cached = await runGit(repo, ["diff", "--binary", "--cached", "--root"]);
  const worktree = await runGit(repo, ["diff", "--binary"]);

  if (cached.exitCode !== 0) {
    throw new Error(`Failed to read staged git diff: ${cached.stderr || cached.stdout}`);
  }

  if (worktree.exitCode !== 0) {
    throw new Error(`Failed to read git diff: ${worktree.stderr || worktree.stdout}`);
  }

  return joinDiffs([cached.stdout, worktree.stdout]);
}

async function hasGitHead(repo: string): Promise<boolean> {
  const result = await runGit(repo, ["rev-parse", "--verify", "HEAD"]);
  return result.exitCode === 0;
}

async function collectUntrackedDiff(repo: string, paths: string[]): Promise<string> {
  const diffs: string[] = [];

  for (const path of paths) {
    const result = await runGit(repo, ["diff", "--binary", "--no-index", "--", "/dev/null", path]);

    if (result.exitCode > 1) {
      throw new Error(`Failed to read untracked diff for ${path}: ${result.stderr || result.stdout}`);
    }

    diffs.push(result.stdout);
  }

  return joinDiffs(diffs);
}

function joinDiffs(diffs: string[]): string {
  return diffs.map((diff) => diff.trimEnd()).filter(Boolean).join("\n");
}

function unquoteGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) {
    return path;
  }

  try {
    return JSON.parse(path);
  } catch {
    return path.slice(1, -1);
  }
}
