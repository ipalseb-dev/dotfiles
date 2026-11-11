// Pie fijo del tablero, visible en las dos vistas:
// - dentro de una sesión, lo que antes pintaba la statusline de Claude Code
//   (~/.claude/statusline.sh escribe un JSON por terminal cuando corre dentro de Herdr);
// - en el tablero, los atajos de teclado.
// Además recibe los atajos (⌘1–9, ⌃Tab, ⌘J, ⌘B, ⌘0): es lo único que se ve siempre.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, focused, home, readTextFile, layout, nextCommand, shared, setShared } from "herdr";
import { numbered, open } from "./sessions.js";

const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const inBoard = () => (find(layout(), "vista")?.active ?? "grid") === "grid";
const board = () => run("layout.select", { stack: "vista", child: "grid" });
const enter = (s) => { if (!s) return; open(s); run("layout.select", { stack: "vista", child: "foco" }); };

// ⌘B: pliega la barra lateral a riel (56 px) o la devuelve al ancho que tenía.
function toggleSidebar() {
  const w = find(layout(), "sidebar")?.size?.px ?? 260;
  if (w >= 120) setShared("tablero.sidebar.width", w);
  run("layout.resize", { id: "sidebar", px: w < 120 ? (shared("tablero.sidebar.width") ?? 260) : 56 });
}

export default class Pie extends View {
  init(_props, cx) {
    this.data = {};
    this.raw = {};
    this.read(cx);
    cx.timer.every(2000, (cx) => this.read(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const list = numbered();
        const cur = list.findIndex((s) => s.tab.id === focused()?.tab);
        if (/^go[1-9]$/.test(c)) enter(list[Number(c.slice(2)) - 1]);
        else if (c === "next" && list.length) enter(list[(cur + 1) % list.length]);
        else if (c === "prev" && list.length) enter(list[(cur - 1 + list.length) % list.length]);
        else if (c === "waiting") {
          const order = [...list.slice(cur + 1), ...list.slice(0, cur + 1)];
          enter(order.find((s) => s.status === "blocked") ?? order.find((s) => s.status === "done"));
        } else if (c === "board") board();
        else if (c === "sidebar") toggleSidebar();
        cx.notify();
      }
    });
  }

  read(cx) {
    const t = focused()?.terminal;
    if (!t || inBoard()) return;
    cx.spawn(async (cx) => {
      let txt = null;
      try { txt = await readTextFile(`${home()}/.config/herdr-app/data/tablero-status/${t}.json`); } catch {}
      if (txt === this.raw[t]) return;
      this.raw[t] = txt;
      try { this.data[t] = txt ? JSON.parse(txt) : null; } catch { this.data[t] = null; }
      cx.notify();
    });
  }

  render() {
    const th = theme();
    const d = this.data[focused()?.terminal];
    const sep = () => div().text_color(th.border).child("│");
    const bar = h_flex().id("root").size_full().bg(th.chrome).px(14).gap(12).items_center().text_size(12).text_color(th.dim).overflow_hidden();
    if (inBoard()) {
      const key = (k) => div().px(6).rounded(4).bg(th.raised).text_size(11).text_color(th.muted).child(k);
      return bar.children([["Clic", "entrar"], ["⌘1…9", "ir a esa sesión"], ["⌃Tab", "siguiente"], ["⌘J", "la que te espera"], ["⌘K", "nueva sesión"], ["⌘0", "tablero"], ["⌘B", "barra lateral"]]
        .map(([k, what], i) => h_flex().id(`h-${i}`).gap(6).items_center().child(key(k)).child(div().child(what))));
    }
    if (!d) return bar.child(div().child("Claude aún no ha enviado datos de esta sesión"));
    const ctxColor = d.ctx >= 80 ? th.blocked : d.ctx >= 50 ? th.working : th.done;
    const qColor = d.qrem == null ? th.dim : d.qrem <= 15 ? th.blocked : d.qrem <= 40 ? th.working : th.muted;
    return bar
      .child(div().text_color(th.muted).truncate().child(d.dir))
      .when(!!d.branch, (el) => el.child(sep()).child(div().text_color(th.ansi2).child(`⎇ ${d.branch}${d.dirty ? " *" : ""}`)))
      .when(!!d.account, (el) => el.child(sep()).child(div().text_color(th.ansi11).child(d.account)))
      .child(div().flex_1())
      .child(div().text_color(th.muted).child(d.model))
      .child(sep())
      .child(h_flex().gap(6).items_center()
        .child(div().child("contexto"))
        .child(div().w(70).h(6).rounded(3).bg(th.raised).child(div().h_full().rounded(3).bg(ctxColor).w(Math.max(2, Math.min(70, Math.round(d.ctx * 0.7))))))
        .child(div().text_color(ctxColor).child(`${d.ctx}%`)))
      .when(d.qrem != null, (el) => el.child(sep())
        .child(div().text_color(qColor).child(`5 h: ${d.qrem}% libre${d.reset ? ` · reset ${d.reset}` : ""}`)));
  }
}
