// Carpetas fijadas (config local) y después cada carpeta de projectsDir.
// Los nombres legibles salen de Pulse, cruzando el remoto de git de cada carpeta.
import { exec } from "herdr";
import { loadConfig } from "./config.js";
import { pulseProjects, repoOfFolder, pulseName } from "./pulse.js";

const key = (n) => n.toLowerCase().replace(/^[^a-z0-9]+/, "");

// Primero rápido (nombres de carpeta); `named` completa con Pulse.
export async function loadProjects() {
  const cfg = await loadConfig();
  const r = await exec("ls", ["-1p", cfg.projectsDir]);
  const list = r.stdout.split("\n").filter((l) => l.endsWith("/")).map((l) => l.slice(0, -1))
    .map((d) => ({ name: d, dir: d, folder: `${cfg.projectsDir}/${d}` }));
  return { pinned: cfg.pinned, list };
}

export async function named(list) {
  const pp = await pulseProjects();
  if (!pp.length) return list;
  const byRepo = new Map(pp.filter((p) => p.githubRepo).map((p) => [p.githubRepo.toLowerCase(), p]));
  const repos = await Promise.all(list.map((p) => repoOfFolder(p.folder).catch(() => "")));
  // Worktrees y copias comparten remoto: el nombre de Pulse es solo para la carpeta
  // principal (la que se llama como el repo); si ninguna coincide, para la única que haya.
  const groups = new Map();
  list.forEach((p, i) => { if (byRepo.has(repos[i])) groups.set(repos[i], [...(groups.get(repos[i]) ?? []), i]); });
  const owner = new Map();
  for (const [repo, idx] of groups) {
    const base = repo.split("/").pop();
    const main = idx.find((i) => list[i].dir.toLowerCase() === base) ?? (idx.length === 1 ? idx[0] : null);
    if (main != null) owner.set(main, byRepo.get(repo));
  }
  return list.map((p, i) => (owner.has(i) ? { ...p, name: pulseName(owner.get(i)) } : p));
}

export const sorted = (list) => [...list].sort((a, b) => (key(a.name) < key(b.name) ? -1 : key(a.name) > key(b.name) ? 1 : 0));
