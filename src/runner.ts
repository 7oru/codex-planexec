import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { createRunDirectory, writeJsonArtifact, writeTextArtifact } from "./artifacts.ts";
import { collectGitSnapshot } from "./git.ts";
import { selectDiffHunks } from "./evidence.ts";
import { evaluateWritePolicy } from "./policy.ts";
import { calculateReviewStatus } from "./review.ts";
import { normalizeTaskSpec } from "./task.ts";
import { runValidationCommands } from "./validation.ts";
import { runKimiWorker } from "./worker.ts";
import type { ChangedFileSummary, ReviewPacket, TaskSpec } from "./types.ts";

export type RunOptions = {
  taskPath: string;
  repo: string;
  out: string;
};

export async function runHarness(options: RunOptions): Promise<ReviewPacket> {
  const repo = resolve(options.repo);
  const runDir = await createRunDirectory(options.out);
  const task = await readTaskSpec(options.taskPath);
  const preSnapshot = await collectGitSnapshot(repo);

  await writeJsonArtifact(runDir, "task.json", task);
  const workerPrompt = buildWorkerPrompt(task);
  await writeTextArtifact(runDir, "worker-prompt.md", workerPrompt);
  await writeTextArtifact(runDir, "pre-status.txt", preSnapshot.status);

  const workerRun = await runKimiWorker({
    repo,
    task,
    prompt: workerPrompt,
  });
  await writeTextArtifact(runDir, "stdout.log", workerRun.stdout);
  await writeTextArtifact(runDir, "stderr.log", workerRun.stderr);

  const postSnapshot = await collectGitSnapshot(repo);
  const changedFiles = excludeRunArtifacts(postSnapshot.changedFiles, repo, runDir);
  const policy = evaluateWritePolicy(changedFiles, task);
  const workerOutput = workerRun.stdout;
  const shouldValidate =
    !workerOutput.trimStart().startsWith("BLOCKED:") &&
    !workerRun.worker.timed_out &&
    workerRun.worker.exit_code === 0 &&
    policy.status === "passed";
  const validation = shouldValidate
    ? await runValidationCommands({
        repo,
        runDir,
        commands: task.validation_commands,
        budget: task.review_budget,
      })
    : {
        status: "skipped" as const,
        failures: [],
      };
  const worker = workerRun.worker;
  const status = calculateReviewStatus({
    workerOutput,
    worker,
    policy,
    validation,
  });
  const review: ReviewPacket = {
    status,
    changed_files: summarizeChangedFiles(changedFiles),
    policy,
    validation,
    review_focus: changedFiles,
    selected_diff_hunks: selectDiffHunks(postSnapshot.diff, task.review_budget),
    worker_report: compactWorkerReport(workerOutput, workerRun.stderr),
    worker,
    artifacts: {
      diff: "diff.patch",
      stdout: "stdout.log",
      stderr: "stderr.log",
    },
    summary: "Harness run completed; inspect compressed status, policy, validation, and artifact paths.",
  };

  await writeTextArtifact(runDir, "post-status.txt", postSnapshot.status);
  await writeTextArtifact(runDir, "changed-files.txt", `${changedFiles.join("\n")}${changedFiles.length > 0 ? "\n" : ""}`);
  await writeTextArtifact(runDir, "diff.patch", postSnapshot.diff);
  await writeJsonArtifact(runDir, "review.json", review);

  return review;
}

async function readTaskSpec(taskPath: string): Promise<TaskSpec> {
  const raw = await readFile(taskPath, "utf8");
  return normalizeTaskSpec(JSON.parse(raw));
}

function buildWorkerPrompt(task: TaskSpec): string {
  return `You are an execution worker, not the planner.

Goal:
${task.goal}

Instructions:
${task.instructions}

Allowed write paths:
${task.allowed_write_paths.map((path) => `- ${path}`).join("\n")}

Blocked paths:
${task.blocked_paths.map((path) => `- ${path}`).join("\n")}

If blocked, write BLOCKED with the reason. Return evidence, not claims.
`;
}

function excludeRunArtifacts(changedFiles: string[], repo: string, runDir: string): string[] {
  const runDirRelative = relative(resolve(repo), resolve(runDir)).replaceAll("\\", "/");

  if (runDirRelative.startsWith("..") || runDirRelative === "") {
    return changedFiles;
  }

  return changedFiles.filter((file) => !isRunArtifactStatusPath(file, runDirRelative));
}

function isRunArtifactStatusPath(file: string, runDirRelative: string): boolean {
  const normalizedFile = file.replace(/\/$/, "");
  const normalizedRunDir = runDirRelative.replace(/\/$/, "");

  return (
    normalizedFile === normalizedRunDir ||
    normalizedFile.startsWith(`${normalizedRunDir}/`) ||
    normalizedRunDir.startsWith(`${normalizedFile}/`)
  );
}

function summarizeChangedFiles(changedFiles: string[]): ChangedFileSummary[] {
  return changedFiles.map((path) => ({
    path,
    additions: 0,
    deletions: 0,
    summary: "Changed file detected by git status.",
  }));
}

function compactWorkerReport(stdout: string, stderr: string): string {
  const report = stdout.trim() || stderr.trim();
  return report.length > 1000 ? `${report.slice(0, 985)}\n...[truncated]` : report;
}
