# codex-planexec

Inspired by Claude Code's opusplan mode: use a stronger model for planning/review and a cheaper or faster CLI agent for bounded execution.

`codex-planexec` is a harness, not a new agent. Codex owns the task spec, review boundary, and final accept/reject decision. A worker CLI such as Kimi performs the implementation turn, while the harness captures artifacts, enforces write policy, runs validation, and returns compressed evidence.

## Current MVP

- Codex plugin scaffold under `plugins/codex-planexec/`
- `codex-planexec run --task <task.json> --repo <repo> --out <run-dir>`
- `kimi info` preflight before worker execution
- Kimi-compatible worker invocation through non-interactive print mode
- Git checkpoint capture before and after worker execution
- Allowed/blocked path policy gate
- Validation command runner with full logs saved as artifacts
- Compressed `review.json` with changed file stats, policy/validation summaries, selected diff hunks, worker report, warnings, and artifact paths

## Usage

Create a task file:

```json
{
  "id": "demo",
  "goal": "Implement the requested change.",
  "instructions": "Only touch files needed for this task.",
  "allowed_write_paths": ["src/**", "tests/**"],
  "validation_commands": ["npm test"],
  "worker": {
    "kind": "kimi",
    "command": "kimi",
    "max_steps_per_turn": 20,
    "extra_args": []
  }
}
```

Run the harness:

```bash
codex-planexec run \
  --task ./task.json \
  --repo /path/to/repo \
  --out /path/to/repo/.codex-planexec/runs/demo
```

The command prints the compressed review packet and writes full artifacts to the run directory.

## Review Model

Codex should read `review.json` first. Full logs and diffs are kept on disk for drill-down review, but they are not included in the default review packet. This keeps Codex focused on evidence instead of replaying the worker's entire context.
