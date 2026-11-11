// Tablero: todas las sesiones como tarjetas iguales, con un resumen en vivo de qué pasa en cada una.
// Clic en una tarjeta → se abre a pantalla completa (stack "vista" → "foco").
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { hc, run, theme, settings, home, readTextFile, layout } from "herdr";
import { sessions, open, ago, color, label, askClose, LABEL } from "./sessions.js";

// Rejilla fija de 4 × 3: doce sesiones a la vista; con más, se desplaza.
const COLS = 4, ROWS = 3, GAP = 14;

// Resume una pantalla de Claude Code en lo que sirve para saber qué pasa:
// lo último que pidió la persona, lo último que respondió Claude, la herramienta en curso,
// la línea de estado y, si está esperando, su pregunta.
const DOT = /^[●⏺] /;               // Claude marca sus respuestas y pasos con ⏺
const TOOL = /^[●⏺] [\w@.-]+\(/;
const SPIN = /^[✻✶✳✢✽·+*]\s+\S/;
function summarize(text) {
  let lines = (text ?? "").split("\n").map((l) => l.replace(/\s+$/, ""));
  let box = -1;
  for (let i = lines.length - 2; i >= 0; i--) if (/^─{10,}/.test(lines[i]) && /^\s*❯/.test(lines[i + 1])) { box = i; break; }
  const after = box >= 0 ? [] : lines.slice(-14).filter((l) => l.trim());
  if (box >= 0) lines = lines.slice(0, box);
  lines = lines.filter((l) => l.trim() && !/^\[hc\]/.test(l));
  const out = { user: null, says: [], tool: null, status: null, recap: null, ask: after };
  let saysAt = -1, toolAt = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (out.user == null && /^❯\s+\S/.test(l)) out.user = l.replace(/^❯\s+/, "");
    if (out.status == null && SPIN.test(l) && /…|for \d|done/.test(l)) out.status = l.replace(SPIN, (m) => m.slice(-1)).trim();
    if (out.recap == null && /^※ recap:/.test(l)) out.recap = l.replace(/^※ recap:\s*/, "");
    if (toolAt < 0 && TOOL.test(l)) { toolAt = i; out.tool = l.replace(DOT, ""); }
    if (saysAt < 0 && DOT.test(l) && !TOOL.test(l)) saysAt = i;
    if (out.user != null && saysAt >= 0 && toolAt >= 0 && out.status != null) break;
  }
  if (saysAt >= 0) {
    out.says.push(lines[saysAt].replace(DOT, ""));
    for (let k = saysAt + 1; k < lines.length && out.says.length < 6; k++) {
      const l = lines[k];
      if (!/^\s{2,}\S/.test(l) || /^\s*⎿/.test(l)) break;
      out.says.push(l.trim());
    }
  }
  if (toolAt < saysAt) out.tool = null; // la herramienta ya terminó: lo último es la respuesta
  return out;
}

// La ✕ no debe abrir la tarjeta: para el clic antes de que llegue a ella.
function closeBtn(id, s, t) {
  return div().id(id).px(6).rounded(4).text_size(13).text_color(t.dim)
    .hover((st) => st.bg(t.hover).text_color(t.foreground))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_click((_e, cx) => { cx.stop_propagation(); askClose(s); })
    .child("✕");
}

function hints(t, items) {
  return h_flex().gap(16).flex_wrap().pt(8).text_size(12).text_color(t.dim).children(items.map(([k, what], i) =>
    h_flex().id(`h-${i}`).gap(6).items_center()
      .child(div().px(6).py(1).rounded(4).bg(t.surface).border(1).border_color(t.border).text_color(t.muted).child(k))
      .child(div().child(what))));
}

// Solo trabaja cuando se ve: cada redibujo de un mod redibuja la ventana entera,
// también la terminal en la que se está escribiendo.
const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const visible = () => (find(layout(), "vista")?.active ?? "grid") === "grid";

export default class Tablero extends View {
  init(_props, cx) {
    this.preview = {};
    this.st = {};
    this.width = 1200;
    this.height = 800;
    this.refresh(cx);
    cx.timer.every(2500, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.busy || !visible()) return;
    this.busy = true;
    const before = JSON.stringify([this.preview, this.st]);
    cx.spawn(async (cx) => {
      try {
        for (const s of sessions()) {
          const r = await hc(["read", s.terminal, "--lines", "700"]).catch(() => null);
          const out = typeof r === "string" ? r : r?.stdout;
          if (out != null) this.preview[s.terminal] = summarize(out);
          try { this.st[s.terminal] = JSON.parse(await readTextFile(`${home()}/.config/herdr-app/data/tablero-status/${s.terminal}.json`)); }
          catch { this.st[s.terminal] = null; }
        }
      } finally {
        this.busy = false;
      }
      if (JSON.stringify([this.preview, this.st]) !== before) cx.notify();
    });
  }

  card(s, t, mono, n, all) {
    const c = color(t, s.status);
    const waiting = s.status === "blocked";
    return v_flex()
      .id(`card-${s.key}`)
      .w(this.cw).h(this.ch).flex_none()
      .rounded(10).border(waiting ? 2 : 1).border_color(waiting ? c : t.border)
      .bg(t.background).overflow_hidden()
      .hover((st) => st.border_color(t.accent))
      .on_click(() => { open(s); run("layout.select", { stack: "vista", child: "foco" }); })
      .child(
        h_flex().px(12).pt(10).pb(6).gap(8).items_center()
          .child(div().px(6).py(1).rounded(4).bg(t.surface).border(1).border_color(t.border).text_size(11).text_color(t.muted).child(n <= 9 ? `⌘${n}` : `${n}`))
          .child(div().w(9).h(9).rounded(5).bg(c).flex_none())
          .child(div().text_size(12).font_semibold().text_color(c).child(s.status ? LABEL[s.status] : (s.program?.name ?? "Terminal")))
          .child(div().flex_1())
          .child(div().text_size(12).text_color(t.dim).child(s.status ? ago(s.since) : ""))
          .child(closeBtn(`x-${s.key}`, s, t)))
      .child(
        div().px(12).pb(6).text_size(15).font_semibold().text_color(t.foreground).truncate()
          .child(label(s)))
      .child(this.meta(s, t, all))
      .child(this.body(s, t));
  }

  body(s, t) {
    const p = this.preview[s.terminal];
    const row = (id, tag, tagColor, lines, color_) => h_flex().id(id).gap(8).items_start()
      .child(div().w(62).flex_none().text_size(11).font_semibold().text_color(tagColor).child(tag))
      .child(v_flex().flex_1().min_w(0).text_size(12).text_color(color_).children(lines.map((l, i) => div().id(`${id}-${i}`).truncate().child(l))));
    const box = v_flex().px(12).pb(10).gap(6).flex_1().overflow_hidden();
    if (!p) return box.child(div().text_size(12).text_color(t.dim).child("…"));
    if (s.status === "blocked" && p.ask.length) return box.child(row("ask", "Pregunta", t.blocked, p.ask.slice(0, 7), t.foreground));
    const quiet = s.status === "idle" || s.status === "done";
    return box
      .when(!!p.user, (el) => el.child(row("u", "Tú", t.accent, [p.user], t.foreground)))
      .when(p.says.length > 0, (el) => el.child(row("c", "Claude", t.muted, p.says.slice(0, 4), t.muted)))
      .when(!!p.tool, (el) => el.child(row("t", "Paso", t.working, [p.tool], t.dim)))
      .when(quiet && !!p.recap, (el) => el.child(row("r", "Resumen", t.done, [p.recap], t.dim)))
      .when(!!p.status && !(quiet && p.recap), (el) => el.child(row("a", "Ahora", t.dim, [p.status], t.dim)));
  }

  // Rama, contexto y aviso si otra sesión trabaja en la misma carpeta (se pisarían).
  meta(s, t, all) {
    const st = this.st[s.terminal];
    const branch = st?.branch || s.branch;
    const dirty = st?.dirty;
    const ctx = st?.ctx;
    const twin = all.findIndex((o) => o !== s && o.cwd && o.cwd === s.cwd);
    const ctxColor = ctx >= 80 ? t.blocked : ctx >= 50 ? t.working : t.done;
    return h_flex().px(12).pb(6).gap(10).items_center().text_size(11).text_color(t.dim)
      .when(!!branch, (el) => el.child(div().truncate().text_color(t.ansi2).child(`⎇ ${branch}${dirty ? " *" : ""}`)))
      .when(ctx != null, (el) => el.child(h_flex().gap(5).items_center().flex_none()
        .child(div().w(44).h(5).rounded(3).bg(t.raised).child(div().h_full().rounded(3).bg(ctxColor).w(Math.max(2, Math.round(ctx * 0.44)))))
        .child(div().text_color(ctxColor).child(`ctx ${ctx}%`))))
      .when(twin >= 0, (el) => el.child(div().flex_none().text_color(t.working).child(`⚠ misma carpeta que ⌘${twin + 1}`)));
  }

  render(cx) {
    // Oculto (dentro de una sesión) no pinta nada: Herdr re-renderiza todos los mods con cada
    // cambio de título o estado de Claude, y pintar las tarjetas ahí hacía ir a tirones al escribir.
    if (!visible()) return div().id("root").size_full();
    const t = theme();
    const mono = settings()?.font_family ?? "JetBrains Mono";
    const all = sessions();
    const agents = all;
    const waiting = agents.filter((s) => s.status === "blocked").length;
    const inner = this.width - 32;
    this.cw = Math.floor((inner - GAP * (COLS - 1)) / COLS);
    this.ch = Math.max(200, Math.floor((this.height - 32 - 50 - GAP * (ROWS - 1)) / ROWS));
    const rows = [];
    for (let i = 0; i < agents.length; i += COLS) rows.push(agents.slice(i, i + COLS));

    return v_flex()
      .id("root").size_full().bg(t.canvas).p(16).gap(14).overflow_y_scrollbar()
      .on_size_change((size, cx) => { this.width = size.width; this.height = size.height; cx.notify(); })
      .child(
        h_flex().gap(12).items_center()
          .child(div().text_size(18).font_semibold().text_color(t.foreground).child("Tablero"))
          .child(div().text_size(13).text_color(t.dim).child(`${agents.length} ${agents.length === 1 ? "sesión abierta" : "sesiones abiertas"}`))
          .when(waiting > 0, (el) => el.child(div().text_size(13).font_semibold().text_color(t.blocked).child(`· ${waiting} te ${waiting === 1 ? "espera" : "esperan"}`)))
          .child(div().flex_1())
          .child(h_flex().id("nueva").px(12).py(6).gap(8).items_center().rounded(8).bg(t.solid).text_color(t.solid_foreground).text_size(13)
            .hover((st) => st.opacity(0.88))
            .on_click(() => run("mod.open", { name: "tablero-ir" }))
            .child("＋ Nueva sesión")
            .child(div().text_size(11).opacity(0.75).child("⌘K"))))
      .when(agents.length === 0, (el) => el.child(
        div().text_size(13).text_color(t.dim).child("No tienes ninguna sesión abierta. Pulsa ⌘K para abrir una en cualquier proyecto.")))
      .children(rows.map((row, i) => h_flex().id(`row-${i}`).gap(14).children(row.map((s) => this.card(s, t, mono, agents.indexOf(s) + 1, agents)))));
  }
}
