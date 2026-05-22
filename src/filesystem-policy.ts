import { createHash } from "node:crypto";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { matchesAny, normalizeGitPath } from "./policy.ts";

export type FilesystemPolicySnapshot = Map<string, string>;

type SnapshotRoot = {
  path: string;
  recursive: boolean;
  shallowChildren: boolean;
};

const SENSITIVE_GIT_POLICY_ROOTS: SnapshotRoot[] = [
  { path: ".git/config", recursive: false, shallowChildren: false },
  { path: ".git/config.worktree", recursive: false, shallowChildren: false },
  { path: ".git/hooks", recursive: true, shallowChildren: true },
  { path: ".git/info", recursive: true, shallowChildren: true },
  { path: ".git/objects/info/alternates", recursive: false, shallowChildren: false },
];

export async function collectFilesystemPolicySnapshot(
  repo: string,
  blockedPaths: string[],
): Promise<FilesystemPolicySnapshot> {
  const repoRoot = resolve(repo);
  const snapshot: FilesystemPolicySnapshot = new Map();

  for (const root of uniqueRoots(blockedPaths.flatMap(snapshotRootsForPattern))) {
    await collectRootSnapshot(repoRoot, root, blockedPaths, snapshot);
  }

  return snapshot;
}

export function diffFilesystemPolicySnapshots(
  before: FilesystemPolicySnapshot,
  after: FilesystemPolicySnapshot,
): string[] {
  const changed = new Set<string>();
  const paths = new Set([...before.keys(), ...after.keys()]);

  for (const path of paths) {
    if (before.get(path) !== after.get(path)) {
      changed.add(path);
    }
  }

  return [...changed].sort();
}

function snapshotRootsForPattern(pattern: string): SnapshotRoot[] {
  const normalized = normalizeGitPath(pattern).replace(/\/+$/, "");

  if (normalized === "") {
    return [];
  }

  if (normalized === ".git/**") {
    return SENSITIVE_GIT_POLICY_ROOTS;
  }

  const firstGlobIndex = normalized.indexOf("*");

  if (firstGlobIndex === -1) {
    return [{ path: normalized, recursive: false, shallowChildren: false }];
  }

  const fixedPrefix = normalized.slice(0, firstGlobIndex);
  const rootSlashIndex = fixedPrefix.lastIndexOf("/");

  if (rootSlashIndex === -1) {
    return [
      {
        path: "",
        recursive: normalized.includes("/") || normalized.includes("**"),
        shallowChildren: true,
      },
    ];
  }

  const path = fixedPrefix.slice(0, rootSlashIndex);
  const remainder = normalized.slice(rootSlashIndex + 1);

  return [{ path, recursive: remainder.includes("/") || remainder.includes("**"), shallowChildren: true }];
}

async function collectRootSnapshot(
  repoRoot: string,
  root: SnapshotRoot,
  blockedPaths: string[],
  snapshot: FilesystemPolicySnapshot,
): Promise<void> {
  const absoluteRoot = resolve(repoRoot, root.path || ".");

  if (!isInsidePath(repoRoot, absoluteRoot)) {
    return;
  }

  await collectEntrySnapshot(absoluteRoot, root.path, root.recursive, root.shallowChildren, blockedPaths, snapshot);
}

async function collectEntrySnapshot(
  absolutePath: string,
  relativePath: string,
  recursive: boolean,
  scanChildren: boolean,
  blockedPaths: string[],
  snapshot: FilesystemPolicySnapshot,
): Promise<void> {
  let stat;

  try {
    stat = await lstat(absolutePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }

  const normalizedPath = normalizeGitPath(relativePath);

  if (stat.isDirectory()) {
    const names = await readdir(absolutePath);

    if (names.length === 0 && normalizedPath !== "" && matchesPolicyPath(`${normalizedPath}/`, blockedPaths)) {
      snapshot.set(`${normalizedPath}/`, `directory:${stat.mode}`);
    }

    if (!recursive && !scanChildren) {
      return;
    }

    await Promise.all(
      names.map((name) =>
        collectEntrySnapshot(
          join(absolutePath, name),
          normalizedPath === "" ? name : `${normalizedPath}/${name}`,
          recursive,
          recursive,
          blockedPaths,
          snapshot,
        ),
      ),
    );
    return;
  }

  if (normalizedPath !== "" && matchesPolicyPath(normalizedPath, blockedPaths)) {
    snapshot.set(normalizedPath, await fingerprintEntry(absolutePath, stat));
  }
}

async function fingerprintEntry(absolutePath: string, stat: Awaited<ReturnType<typeof lstat>>): Promise<string> {
  if (stat.isSymbolicLink()) {
    return `symlink:${stat.mode}:${await readlink(absolutePath)}`;
  }

  if (stat.isFile()) {
    const hash = createHash("sha256").update(await readFile(absolutePath)).digest("hex");
    return `file:${stat.mode}:${stat.size}:${hash}`;
  }

  return `other:${stat.mode}:${stat.size}:${stat.mtimeMs}`;
}

function matchesPolicyPath(path: string, blockedPaths: string[]): boolean {
  return matchesAny(path, blockedPaths);
}

function uniqueRoots(roots: SnapshotRoot[]): SnapshotRoot[] {
  const deduped = new Map<string, SnapshotRoot>();

  for (const root of roots) {
    const normalized = normalizeGitPath(root.path).replace(/\/+$/, "");
    const key = `${normalized}\0${root.recursive ? "recursive" : "shallow"}\0${
      root.shallowChildren ? "children" : "self"
    }`;
    deduped.set(key, {
      path: normalized,
      recursive: root.recursive,
      shallowChildren: root.shallowChildren,
    });
  }

  return [...deduped.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function isInsidePath(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
