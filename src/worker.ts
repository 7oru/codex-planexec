import { spawn } from "node:child_process";

import type { TaskSpec, WorkerResult } from "./types.ts";

export type WorkerRun = {
  stdout: string;
  stderr: string;
  worker: WorkerResult;
};

export async function runKimiInfo(input: { repo: string; task: TaskSpec; timeoutMs?: number }): Promise<WorkerRun> {
  return runProcess({
    command: input.task.worker.command,
    args: ["info"],
    cwd: input.repo,
    timeoutMs: input.timeoutMs ?? 30 * 1000,
  });
}

export function assertKimiInfoSucceeded(command: string, result: WorkerRun): void {
  if (result.worker.timed_out) {
    throw new Error(`Kimi worker preflight timed out: ${command} info`);
  }

  if (result.worker.exit_code !== 0) {
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
    const excerpt = detail.length > 1000 ? `${detail.slice(0, 985)}\n...[truncated]` : detail;
    const suffix = excerpt ? `\n${excerpt}` : "";

    throw new Error(`Kimi worker preflight failed: ${command} info exited with code ${result.worker.exit_code}${suffix}`);
  }
}

export async function runKimiWorker(input: {
  repo: string;
  task: TaskSpec;
  prompt: string;
  timeoutMs?: number;
}): Promise<WorkerRun> {
  const args = [
    "--work-dir",
    input.repo,
    "--print",
    "--quiet",
    "--afk",
    "--max-steps-per-turn",
    String(input.task.worker.max_steps_per_turn),
    ...input.task.worker.extra_args,
    "-p",
    input.prompt,
  ];

  return runProcess({
    command: input.task.worker.command,
    args,
    cwd: input.repo,
    timeoutMs: input.timeoutMs ?? 15 * 60 * 1000,
  });
}

function runProcess(input: { command: string; args: string[]; cwd: string; timeoutMs: number }): Promise<WorkerRun> {
  return new Promise((resolve) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        stdout: "",
        stderr: error.message,
        worker: {
          exit_code: 1,
          timed_out: false,
        },
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        worker: {
          exit_code: exitCode ?? 1,
          timed_out: timedOut,
        },
      });
    });
  });
}
