#!/usr/bin/env node

type CommandResult = {
  exitCode: number;
  output?: string;
  error?: string;
};

const VERSION = "0.1.0";

function main(argv: string[]): CommandResult {
  const [command, ...args] = argv;

  if (!command || command === "--help" || command === "-h") {
    return { exitCode: 0, output: rootHelp() };
  }

  if (command === "--version" || command === "-v") {
    return { exitCode: 0, output: VERSION };
  }

  if (command === "run") {
    return runCommand(args);
  }

  return {
    exitCode: 2,
    error: `Unknown command: ${command}\n\n${rootHelp()}`,
  };
}

function runCommand(args: string[]): CommandResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { exitCode: 0, output: runHelp() };
  }

  const options = parseOptions(args);
  const missing = ["task", "repo", "out"].filter((name) => !options[name]);

  if (missing.length > 0) {
    return {
      exitCode: 2,
      error: `Missing required option(s): ${missing.map((name) => `--${name}`).join(", ")}\n\n${runHelp()}`,
    };
  }

  return {
    exitCode: 2,
    error: "The run command is scaffolded but worker execution is not implemented yet.",
  };
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const name = arg.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith("--")) {
      options[name] = "";
      continue;
    }

    options[name] = value;
    index += 1;
  }

  return options;
}

function rootHelp(): string {
  return `codex-planexec ${VERSION}

Usage:
  codex-planexec <command> [options]

Commands:
  run    Run a bounded worker task from a task.json file

Options:
  -h, --help       Show help
  -v, --version    Show version
`;
}

function runHelp(): string {
  return `codex-planexec run

Usage:
  codex-planexec run --task <task.json> --repo <repo> --out <run-dir>

Required options:
  --task <path>    Path to the planner-authored task.json
  --repo <path>    Git repository where the worker should run
  --out <path>     Run artifact directory
`;
}

const result = main(process.argv.slice(2));

if (result.output) {
  console.log(result.output);
}

if (result.error) {
  console.error(result.error);
}

process.exitCode = result.exitCode;
