---
name: planexec
description: Use the codex-planexec harness to delegate bounded implementation work from Codex to a CLI worker agent, then review compressed evidence before accepting or requesting fixes.
---

# PlanExec

Use this skill when the user wants Codex to plan or review while a worker CLI agent performs bounded execution work.

## Current Status

The MVP harness can run a configured Kimi-compatible worker command, collect Git checkpoints, enforce write policy, run validation commands, and emit a compressed `review.json` packet. Treat Codex as the final reviewer even when the harness returns `accepted_candidate`.

## Intended Workflow

1. Codex writes a focused task spec with allowed paths, blocked paths, validation commands, and review budget.
2. `codex-planexec` creates a run directory and delegates execution to a configured worker.
3. The harness stores full artifacts on disk, including stdout, stderr, validation logs, and diff patches.
4. Codex reviews only the compressed `review.json` by default.
5. Codex drills into full artifacts only when the compressed evidence points to a specific issue.

## Review Principle

Keep Codex usage low: pass changed file summaries, policy results, validation excerpts, selected diff hunks, and artifact paths instead of full logs or full diffs.
