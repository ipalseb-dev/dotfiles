// Pulse por su MCP HTTP, el mismo que tiene configurado Claude Code en ~/.claude.json
// (mcpServers.pulse). Sin ese servidor, todo devuelve vacío y el tablero funciona igual.
import { home, readTextFile, exec } from "herdr";

let server;
async function getServer() {
  if (server !== undefined) return server;
  try {
    const s = JSON.parse(await readTextFile(`${home()}/.claude.json`)).mcpServers?.pulse;
    server = s?.url ? { url: s.url, headers: s.headers ?? {} } : null;
  } catch { server = null; }
  return server;
}

async function call(name, args) {
  const s = await getServer();
  if (!s) return null;
  const r = await fetch(s.url, {
    method: "POST",
    headers: { ...s.headers, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const j = await r.json();
  return JSON.parse(j.result.content[0].text);
}

// "git@github.com:Org/Repo.git" → "org/repo"
const repoOf = (url) => (url.trim().match(/github\.com[:/](.+?)(\.git)?$/)?.[1] ?? "").toLowerCase();

let projects = null;
export async function pulseProjects() {
  projects ??= (await call("list_projects", {}).catch(() => null)) ?? [];
  return projects;
}

export async function repoOfFolder(folder) {
  const r = await exec("git", ["-C", folder, "remote", "get-url", "origin"]).catch(() => null);
  return r?.code === 0 ? repoOf(r.stdout) : "";
}

export async function pulseProjectFor(folder) {
  const repo = await repoOfFolder(folder);
  if (!repo) return null;
  return (await pulseProjects()).find((p) => (p.githubRepo ?? "").toLowerCase() === repo) ?? null;
}

// Nombre legible desde Pulse: "Área · Proyecto", o solo el proyecto si ya lo dice.
export const pulseName = (p) => (!p.area || p.name.toLowerCase().includes(p.area.toLowerCase()) ? p.name : `${p.area} · ${p.name}`);

const ORDER = { IN_PROGRESS: 0, BLOCKED: 1, PENDING: 2, IN_REVIEW: 3 };
export async function openTasks(key) {
  const list = (await call("list_tasks", { project: key })) ?? [];
  return list.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
}
