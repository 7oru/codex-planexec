import type { PolicyResult, ReviewPacket, ReviewStatus, ValidationSummary, WorkerResult } from "./types.ts";

export function calculateReviewStatus(input: {
  workerOutput: string;
  worker: WorkerResult;
  policy: PolicyResult;
  validation: ValidationSummary;
}): ReviewStatus {
  if (input.workerOutput.trimStart().startsWith("BLOCKED:")) {
    return "blocked";
  }

  if (input.worker.timed_out || (input.worker.exit_code !== null && input.worker.exit_code !== 0)) {
    return "error";
  }

  if (input.policy.status === "failed") {
    return "rejected";
  }

  if (input.validation.status === "failed") {
    return "needs_fix";
  }

  return "accepted_candidate";
}

export function createEmptyReviewPacket(status: ReviewStatus): ReviewPacket {
  return {
    status,
    changed_files: [],
    policy: {
      status: "passed",
      violations: [],
    },
    validation: {
      status: "skipped",
      failures: [],
    },
    review_focus: [],
    selected_diff_hunks: [],
    worker_report: "",
    worker: {
      exit_code: null,
      timed_out: false,
    },
    artifacts: {
      diff: "diff.patch",
      stdout: "stdout.log",
      stderr: "stderr.log",
    },
    summary: "",
  };
}
