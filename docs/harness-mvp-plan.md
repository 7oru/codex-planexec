# codex-planexec Harness MVP

## Summary

Build `codex-planexec` as a Codex-side harness plugin that lets Codex plan/review while delegating bounded implementation work to `kimi-cli` in non-interactive mode. V1 will support only Kimi as the worker, use Git diffs as the source of truth, enforce path policy after execution, and return a structured review packet for Codex to inspect.

Default stack: Node.js + TypeScript CLI, because subprocess control, JSON schemas, npm packaging, and Codex plugin distribution are straightforward.

## Key Changes

- Add a Codex plugin scaffold with `.codex-plugin/plugin.json` and a `planexec` skill that instructs Codex to use the harness for worker delegation.
- Add a CLI entrypoint `codex-planexec` with one MVP command:

```bash
codex-planexec run --task <task.json> --repo <repo> --out <run-dir>
```

- Define three JSON interfaces:
  - `task.json`: task id, user goal, planner instructions, allowed/blocked paths, validation commands, worker config.
  - `review.json`: status, worker exit info, changed files, policy violations, validation results, summary, transcript path.
  - `policy.json` optional later; V1 keeps policy embedded in `task.json`.
- Run Kimi through its non-interactive path:

```bash
kimi --work-dir <repo> --print --quiet --afk -p <worker-prompt>
```

- Create a run directory under `.codex-planexec/runs/<timestamp>-<task-id>/` containing:
  - `task.json`
  - `worker-prompt.md`
  - `stdout.log`
  - `stderr.log`
  - `pre-status.txt`
  - `post-status.txt`
  - `changed-files.txt`
  - `diff.patch`
  - `review.json`

## Harness Behavior

- Preflight:
  - Verify `kimi` is available with `kimi info`.
  - Verify `<repo>` is a Git repo.
  - Capture initial `git status --porcelain=v1`.
  - Do not require a clean worktree in V1, but record dirty state and warn in `review.json`.
- Worker prompt:
  - Tell Kimi it is an execution worker, not planner.
  - Require it to stay within task scope.
  - Require `BLOCKED: <reason>` if it cannot proceed.
  - Require evidence in final output, not broad claims.
- Policy gate:
  - After Kimi exits, collect `git diff --name-only`.
  - Fail with `status: "rejected"` if any changed path matches `blocked_paths` or does not match `allowed_write_paths`.
  - Default blocked paths: `.git/**`, `.env`, `.env.*`, `node_modules/**`, lockfiles unless explicitly allowed.
- Validation gate:
  - Run each `validation_commands` entry from `task.json` in order.
  - Store command, exit code, stdout/stderr snippet, and duration.
  - If policy passes but validation fails, return `status: "needs_fix"`.
  - If policy and validation pass, return `status: "accepted_candidate"` rather than final acceptance; Codex remains the real reviewer.
- No auto-revert in V1. If rejected, harness reports violations and leaves the worktree for Codex/user review.

## Public Interfaces

Use this MVP `task.json` shape:

```json
{
  "id": "short-task-id",
  "goal": "Implement the requested change.",
  "instructions": "Planner-authored implementation instructions.",
  "allowed_write_paths": ["src/**", "tests/**"],
  "blocked_paths": [".git/**", ".env", ".env.*", "node_modules/**", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"],
  "validation_commands": ["npm test", "npm run build"],
  "worker": {
    "kind": "kimi",
    "command": "kimi",
    "max_steps_per_turn": 20,
    "extra_args": []
  }
}
```

Use these `review.json` statuses:

```json
{
  "status": "accepted_candidate | needs_fix | rejected | blocked | error",
  "changed_files": [],
  "policy_violations": [],
  "validation_results": [],
  "worker": {
    "exit_code": 0,
    "timed_out": false
  },
  "artifacts": {
    "diff": "diff.patch",
    "stdout": "stdout.log",
    "stderr": "stderr.log"
  },
  "summary": "Short factual summary."
}
```

## Test Plan

- Unit test path policy matching:
  - allowed file passes
  - blocked file fails
  - file outside allowlist fails
  - blocked path wins over allowed path
- Unit test review status calculation:
  - policy violation returns `rejected`
  - validation failure returns `needs_fix`
  - clean policy plus passing validation returns `accepted_candidate`
  - Kimi nonzero exit returns `error` unless output begins with `BLOCKED:`
- Integration test with a fake `kimi` executable:
  - fake worker edits an allowed file and passes validation
  - fake worker edits a blocked file and is rejected
  - fake worker prints `BLOCKED:` and produces `status: "blocked"`
- Manual smoke test:
  - run `codex-planexec run` against this repo with fake Kimi first
  - then run against a tiny disposable Git repo with real `kimi --print --quiet`

## Assumptions

- This is a Codex plugin/harness project, not a Kimi plugin.
- V1 supports only Kimi as the execution worker; other workers come after the harness contract is stable.
- V1 uses post-run policy enforcement instead of sandboxing Kimi at the filesystem layer.
- V1 does not auto-commit, auto-stage, auto-revert, or open PRs.
- Codex remains the final reviewer and state owner; `accepted_candidate` means "ready for Codex review," not merged or trusted.
