// Tablero: todas las sesiones como tarjetas iguales, con las últimas líneas en vivo.
// Clic en una tarjeta → se abre a pantalla completa (stack "vista" → "foco").
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { hc, run, theme, settings, home, readTextFile } from "herdr";
import { sessions, open, ago, color, label, askClose, LABEL } from "./sessions.js";

const CARD_W = 380;
const CARD_H = 210;
const LINES = 9;

// Lo útil de una pantalla de Claude Code está encima de la caja de entrada.
function tail(text) {
  let lines = (text ?? "").split("\n").map((l) => l.replace(/\s+$/, ""));
  const box = lines.findIndex((l, i) => /^─{10,}/.test(l) && /^\s*❯/.test(lines[i + 1] ?? ""));
  if (box > 0) lines = lines.slice(0, box);
  lines = lines.filter((l) => l.trim() && !/^\[hc\]/.test(l));
  return lines.slice(-LINES);
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

export default class Tablero extends View {
  init(_props, cx) {
    this.preview = {};
    this.st = {};
    this.width = 1200;
    this.refresh(cx);
    cx.timer.every(2500, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        for (const s of sessions()) {
          const r = await hc(["read", s.terminal, "--lines", "40"]).catch(() => null);
          const out = typeof r === "string" ? r : r?.stdout;
          if (out != null) this.preview[s.terminal] = tail(out);
          try { this.st[s.terminal] = JSON.parse(await readTextFile(`${home()}/.config/herdr-app/data/tablero-status/${s.terminal}.json`)); }
          catch { this.st[s.terminal] = null; }
        }
      } finally {
        this.busy = false;
      }
      cx.notify();
    });
  }

  card(s, t, mono, n, all) {
    const c = color(t, s.status);
    const waiting = s.status === "blocked";
    return v_flex()
      .id(`card-${s.key}`)
      .w(CARD_W).h(CARD_H).flex_none()
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
        div().px(12).pb(6).text_size(14).font_semibold().text_color(t.foreground).truncate()
          .child(label(s)))
      .child(this.meta(s, t, all))
      .child(
        v_flex().px(12).pb(10).flex_1().overflow_hidden().font_family(mono).text_size(11).text_color(t.muted)
          .children((this.preview[s.terminal] ?? ["…"]).map((l, i) => div().id(`l-${s.key}-${i}`).truncate().child(l || " "))));
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

  addCard(t) {
    return v_flex().id("add").w(CARD_W).h(CARD_H).flex_none().rounded(10).border(1).border_color(t.border)
      .items_center().justify_center().gap(6).text_color(t.dim)
      .hover((st) => st.border_color(t.accent).text_color(t.foreground))
      .on_click(() => run("mod.open", { name: "tablero-ir" }))
      .child(div().text_size(28).child("＋"))
      .child(div().text_size(13).child("Nueva sesión"))
      .child(div().text_size(11).child("o ir a una abierta · ⌘K"));
  }

  render(cx) {
    const t = theme();
    const mono = settings()?.font_family ?? "JetBrains Mono";
    const all = sessions();
    const agents = all;
    const waiting = agents.filter((s) => s.status === "blocked").length;
    const cols = Math.max(1, Math.floor((this.width - 32 + 14) / (CARD_W + 14)));
    const rows = [];
    const cards = [...agents, null];
    for (let i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));

    return v_flex()
      .id("root").size_full().bg(t.canvas).p(16).gap(14).overflow_y_scrollbar()
      .on_size_change((size, cx) => { this.width = size.width; cx.notify(); })
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
      .children(rows.map((row, i) => h_flex().id(`row-${i}`).gap(14).children(row.map((s) => (s ? this.card(s, t, mono, agents.indexOf(s) + 1, agents) : this.addCard(t))))))
      .child(hints(t, [["⌘º", "tablero"], ["⌘1…9", "ir a esa sesión"], ["⌃Tab", "siguiente sesión"], ["⌘J", "ir a la que te espera"], ["⌘K", "nueva sesión"]]));
  }
}
