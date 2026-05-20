export type WorkerKind = "kimi";

export type ReviewStatus = "accepted_candidate" | "needs_fix" | "rejected" | "blocked" | "error";

export type GateStatus = "passed" | "failed";

export type ValidationStatus = "passed" | "failed" | "skipped";

export type WorkerConfig = {
  kind: WorkerKind;
  command: string;
  max_steps_per_turn: number;
  extra_args: string[];
};

export type ReviewBudget = {
  max_diff_hunks: number;
  max_log_excerpt_chars: number;
  include_full_diff: boolean;
  include_full_stdout: boolean;
};

export type TaskSpec = {
  id: string;
  goal: string;
  instructions: string;
  allowed_write_paths: string[];
  blocked_paths: string[];
  validation_commands: string[];
  review_budget: ReviewBudget;
  worker: WorkerConfig;
};

export type ChangedFileSummary = {
  path: string;
  additions: number;
  deletions: number;
  summary: string;
};

export type PolicyResult = {
  status: GateStatus;
  violations: string[];
};

export type ValidationFailure = {
  command: string;
  excerpt: string;
};

export type ValidationSummary = {
  status: ValidationStatus;
  failures: ValidationFailure[];
};

export type WorkerResult = {
  exit_code: number | null;
  timed_out: boolean;
};

export type ArtifactPaths = {
  diff: string;
  stdout: string;
  stderr: string;
};

export type ReviewPacket = {
  status: ReviewStatus;
  changed_files: ChangedFileSummary[];
  policy: PolicyResult;
  validation: ValidationSummary;
  review_focus: string[];
  selected_diff_hunks: string[];
  worker_report: string;
  worker: WorkerResult;
  artifacts: ArtifactPaths;
  summary: string;
};
