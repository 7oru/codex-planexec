import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

export function createRunId(taskId: string, now = new Date()): string {
  const timestamp = now.toISOString().replaceAll(":", "").replaceAll(".", "");
  const safeTaskId = taskId.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${timestamp}-${safeTaskId || "task"}`;
}

export async function createRunDirectory(runDir: string): Promise<string> {
  const absolute = resolve(runDir);
  await mkdir(absolute, { recursive: true });
  return absolute;
}

export async function writeTextArtifact(runDir: string, relativePath: string, content: string): Promise<string> {
  const target = resolveInside(runDir, relativePath);
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

export async function writeJsonArtifact(runDir: string, relativePath: string, value: unknown): Promise<string> {
  return writeTextArtifact(runDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function resolveInside(root: string, child: string): string {
  const absoluteRoot = resolve(root);
  const target = resolve(absoluteRoot, child);
  const pathFromRoot = relative(absoluteRoot, target);

  if (pathFromRoot.startsWith("..") || pathFromRoot === "" || resolve(pathFromRoot) === pathFromRoot) {
    throw new Error(`Artifact path escapes run directory: ${child}`);
  }

  return target;
}
