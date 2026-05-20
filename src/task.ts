import type { ReviewBudget, TaskSpec, WorkerConfig } from "./types.ts";

export const DEFAULT_BLOCKED_PATHS = [
  ".git/**",
  ".env",
  ".env.*",
  "node_modules/**",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

export const DEFAULT_REVIEW_BUDGET: ReviewBudget = {
  max_diff_hunks: 8,
  max_log_excerpt_chars: 4000,
  include_full_diff: false,
  include_full_stdout: false,
};

export const DEFAULT_WORKER: WorkerConfig = {
  kind: "kimi",
  command: "kimi",
  max_steps_per_turn: 20,
  extra_args: [],
};

export function normalizeTaskSpec(input: Partial<TaskSpec>): TaskSpec {
  const required = ["id", "goal", "instructions", "allowed_write_paths"] as const;
  const missing = required.filter((key) => isMissing(input[key]));

  if (missing.length > 0) {
    throw new Error(`Missing required task field(s): ${missing.join(", ")}`);
  }

  return {
    id: input.id!,
    goal: input.goal!,
    instructions: input.instructions!,
    allowed_write_paths: input.allowed_write_paths!,
    blocked_paths: input.blocked_paths ?? DEFAULT_BLOCKED_PATHS,
    validation_commands: input.validation_commands ?? [],
    review_budget: {
      ...DEFAULT_REVIEW_BUDGET,
      ...input.review_budget,
    },
    worker: {
      ...DEFAULT_WORKER,
      ...input.worker,
      extra_args: input.worker?.extra_args ?? DEFAULT_WORKER.extra_args,
    },
  };
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
