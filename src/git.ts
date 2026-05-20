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

  const status = await runGit(repo, ["status", "--porcelain=v1"]);
  const diff = await runGit(repo, ["diff", "--binary"]);

  if (status.exitCode !== 0) {
    throw new Error(`Failed to read git status: ${status.stderr || status.stdout}`);
  }

  if (diff.exitCode !== 0) {
    throw new Error(`Failed to read git diff: ${diff.stderr || diff.stdout}`);
  }

  return {
    status: status.stdout,
    changedFiles: parsePorcelainStatusPaths(status.stdout),
    diff: diff.stdout,
  };
}

export function parsePorcelainStatusPaths(status: string): string[] {
  const paths = new Set<string>();

  for (const line of status.split("\n")) {
    if (line.trim() === "") {
      continue;
    }

    const rawPath = line.slice(3);
    const renamedPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1)! : rawPath;
    paths.add(unquoteGitPath(renamedPath));
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
