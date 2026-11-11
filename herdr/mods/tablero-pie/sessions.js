// Sesiones = una por pestaña, con su terminal principal (el agente si lo hay).
import { panes, spaces, run } from "herdr";

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
export const LABEL = { blocked: "Te espera", done: "Terminado", working: "Trabajando", idle: "En reposo" };

// Título: el nombre que tú le des a la pestaña; si no, el que Claude pone a la terminal
// (resume la conversación); si no, nada y la tarjeta muestra solo el proyecto.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
function titleOf(tab, p) {
  if (tab.named) return tab.name;
  const live = clean(p.title);
  const telling = live && live !== p.program?.name && live.toLowerCase() !== p.program?.key
    && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && !/^claude( code)?$/i.test(live);
  return telling ? live : null;
}

export function sessions() {
  const tabInfo = new Map();
  for (const s of spaces()) for (const t of s.tabs) tabInfo.set(t.id, { space: s, tab: t });
  const lead = new Map();
  for (const p of panes()) {
    if (!p.terminal) continue;
    const cur = lead.get(p.tab);
    if (!cur || (!cur.program?.agent && p.program?.agent)) lead.set(p.tab, p);
  }
  const out = [];
  for (const [tabId, p] of lead) {
    const info = tabInfo.get(tabId);
    if (!info) continue;
    const status = p.status ?? info.tab.status ?? null;
    out.push({
      key: tabId,
      terminal: p.terminal,
      space: info.space,
      tab: info.tab,
      status,
      agent: !!p.program?.agent || !!status,
      program: p.program,
      title: titleOf(info.tab, p),
      since: info.tab.working_since ?? info.tab.changed_at ?? null,
      cwd: p.cwd ?? null,
      branch: p.branch ?? null,
    });
  }
  out.sort((a, b) => a.space.index - b.space.index || a.tab.index - b.tab.index);
  return out;
}

export function open(s) {
  run("space.select", { id: s.space.id });
  run("tab.select", { id: s.tab.id });
  run("pane.focus", { terminal: s.terminal });
}

export function ago(ms) {
  if (!ms) return "";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

export const label = (s) => (s.title ? `${s.space.name} · ${s.title}` : s.space.name);

export const color = (t, status) => (status ? t[status] : t.dim);

// Cerrar una sesión: siempre con confirmación, más clara si el agente está a medias.
import { openOverlay } from "herdr";
export function askClose(s) {
  const busy = s.status === "working" || s.status === "blocked";
  openOverlay({
    mod: "confirm", kind: "dialog", width: 400, height: 180,
    props: {
      title: `¿Cerrar «${label(s)}»?`,
      detail: busy
        ? `Ojo: el agente está ${s.status === "working" ? "trabajando" : "esperándote"}. Se cortará lo que esté haciendo y se cerrará su terminal.`
        : "Se cierra la pestaña y su terminal. Si es la única del espacio, se cierra también el espacio.",
      command: { name: "tab.close", args: { id: s.tab.id, confirmed: true } },
    },
  });
}

// Sesiones numeradas (las que tienen agente), en el orden fijo de arriba.
export const numbered = () => sessions();
