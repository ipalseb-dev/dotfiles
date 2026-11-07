// Worktree nuevo para un segundo agente en el mismo repo: su propia carpeta y rama.
import { exec, home } from "herdr";

export const slug = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "");

export async function isGit(folder) {
  const r = await exec("git", ["-C", folder, "rev-parse", "--is-inside-work-tree"]).catch(() => null);
  return r?.code === 0;
}

export async function makeWorktree(folder, branch) {
  const repo = folder.split("/").pop();
  const path = `${home()}/.herdr/worktrees/${repo}/${branch}`;
  const g = (args) => exec("git", ["-C", folder, ...args]);
  const head = await g(["rev-parse", "--abbrev-ref", "origin/HEAD"]);
  const base = head.code === 0 ? head.stdout.trim() : "HEAD";
  const exists = (await g(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`])).code === 0;
  const r = await g(exists ? ["worktree", "add", path, branch] : ["worktree", "add", "-b", branch, path, base]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "git worktree add falló");
  return { path, base: exists ? branch : base };
}
