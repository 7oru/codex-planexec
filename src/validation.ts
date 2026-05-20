import { spawn } from "node:child_process";

import { writeTextArtifact } from "./artifacts.ts";
import type { ReviewBudget, ValidationSummary } from "./types.ts";

export type ValidationCommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export async function runValidationCommands(input: {
  repo: string;
  runDir: string;
  commands: string[];
  budget: ReviewBudget;
}): Promise<ValidationSummary> {
  const failures: ValidationSummary["failures"] = [];

  if (input.commands.length === 0) {
    return {
      status: "skipped",
      failures,
    };
  }

  for (let index = 0; index < input.commands.length; index += 1) {
    const command = input.commands[index];
    const result = await runShellCommand(input.repo, command);
    const prefix = `validation-${String(index + 1).padStart(2, "0")}`;

    await writeTextArtifact(input.runDir, `${prefix}.stdout.log`, result.stdout);
    await writeTextArtifact(input.runDir, `${prefix}.stderr.log`, result.stderr);

    if (result.exitCode !== 0) {
      failures.push({
        command,
        excerpt: compactFailureExcerpt(result, input.budget.max_log_excerpt_chars),
      });
      break;
    }
  }

  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
  };
}

export function compactFailureExcerpt(result: ValidationCommandResult, maxChars: number): string {
  const combined = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n\n");

  if (combined.length <= maxChars) {
    return combined;
  }

  return `${combined.slice(0, Math.max(0, maxChars - 15))}\n...[truncated]`;
}

function runShellCommand(repo: string, command: string): Promise<ValidationCommandResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, {
      cwd: repo,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    child.on("close", (exitCode) => {
      resolve({
        command,
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        durationMs: Date.now() - started,
      });
    });
  });
}
