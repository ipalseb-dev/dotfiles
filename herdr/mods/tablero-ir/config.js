// Configuración personal, fuera del repo: ~/.config/herdr-app/data/tablero.json
// { "projectsDir": "~/Projects", "pinned": [{ "name": "Notas", "folder": "~/notas" }] }
import { home, readTextFile } from "herdr";

const expand = (p) => (p?.startsWith("~") ? home() + p.slice(1) : p);

export async function loadConfig() {
  let c = {};
  try { c = JSON.parse(await readTextFile(`${home()}/.config/herdr-app/data/tablero.json`)); } catch {}
  return {
    projectsDir: expand(c.projectsDir ?? "~/Projects").replace(/\/$/, ""),
    pinned: (c.pinned ?? []).map((p) => ({ name: p.name, folder: expand(p.folder) })),
  };
}
