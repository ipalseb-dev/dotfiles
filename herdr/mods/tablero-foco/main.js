// Barra fija del tablero: volver al tablero, nueva sesión y atajos. Las sesiones se listan en las
// tarjetas (tablero) y en la barra lateral (dentro de una sesión).
// Recibe los atajos (⌘1–9, ⌃Tab, ⌘J, ⌘B) porque es lo único visible en las dos vistas.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, focused, layout, nextCommand, shared, setShared } from "herdr";
import { numbered, open } from "./sessions.js";

const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const inBoard = () => (find(layout(), "vista")?.active ?? "grid") === "grid";
const board = () => run("layout.select", { stack: "vista", child: "grid" });
// ⌘B: pliega la barra lateral a riel (56 px) o la devuelve al ancho que tenía.
function toggleSidebar() {
  const w = find(layout(), "sidebar")?.size?.px ?? 260;
  if (w >= 120) setShared("tablero.sidebar.width", w);
  run("layout.resize", { id: "sidebar", px: w < 120 ? (shared("tablero.sidebar.width") ?? 260) : 56 });
}
const enter = (s) => { if (!s) return; open(s); run("layout.select", { stack: "vista", child: "foco" }); };

export default class Barra extends View {
  init(_props, cx) {
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

  render() {
    const t = theme();
    const onBoard = inBoard();
    const key = (k) => div().px(5).rounded(4).bg(t.raised).text_size(10).text_color(t.dim).child(k);
    return h_flex()
      .id("root").size_full().bg(t.chrome).px(10).gap(6).items_center().overflow_hidden()
      .child(
        h_flex().id("board").px(10).py(4).gap(6).items_center().rounded(6).flex_none()
          .bg(onBoard ? t.selected : t.chrome).border(1).border_color(onBoard ? t.accent : t.border)
          .hover((s) => s.bg(t.hover)).on_click(board)
          .child(div().text_size(12).text_color(t.foreground).child("⊞ Tablero"))
          .child(key("⌘º")))
      .child(
        h_flex().id("plus").px(10).py(4).gap(6).items_center().rounded(6).flex_none()
          .hover((st) => st.bg(t.hover))
          .on_click(() => run("mod.open", { name: "tablero-ir" }))
          .child(div().text_size(12).text_color(t.accent).child("＋ Nueva"))
          .child(key("⌘K")))
      .child(div().flex_1())
      .child(h_flex().gap(10).flex_none().text_size(11).text_color(t.dim)
        .when(!onBoard, (el) => el.child(h_flex().gap(4).items_center().child(key("⌘B")).child("barra lateral")))
        .child(h_flex().gap(4).items_center().child(key("⌘1…9")).child("ir a sesión"))
        .child(h_flex().gap(4).items_center().child(key("⌃Tab")).child("siguiente"))
        .child(h_flex().gap(4).items_center().child(key("⌘J")).child("la que te espera")));
  }
}
