// Barra fija del tablero: sesiones numeradas, volver al tablero, nueva sesión.
// Recibe los atajos (⌘1–9, ⌃Tab, ⌘J) porque es lo único visible en las dos vistas.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, theme, focused, layout, nextCommand } from "herdr";
import { numbered, open, color, label, askClose } from "./sessions.js";

const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const inBoard = () => (find(layout(), "vista")?.active ?? "grid") === "grid";
const board = () => run("layout.select", { stack: "vista", child: "grid" });
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
        cx.notify();
      }
    });
  }

  render() {
    const t = theme();
    const onBoard = inBoard();
    const cur = focused()?.tab;
    const list = numbered();
    const key = (k) => div().px(5).rounded(4).bg(t.raised).text_size(10).text_color(t.dim).child(k);
    return h_flex()
      .id("root").size_full().bg(t.chrome).px(10).gap(6).items_center().overflow_hidden()
      .child(
        h_flex().id("board").px(10).py(4).gap(6).items_center().rounded(6).flex_none()
          .bg(onBoard ? t.selected : t.chrome).border(1).border_color(onBoard ? t.accent : t.border)
          .hover((s) => s.bg(t.hover)).on_click(board)
          .child(div().text_size(12).text_color(t.foreground).child("⊞ Tablero"))
          .child(key("⌘º")))
      .child(div().w(1).h(18).bg(t.border).flex_none())
      .children(list.map((s, i) => {
        const on = !onBoard && s.tab.id === cur;
        const waiting = s.status === "blocked";
        return h_flex().id(`p-${s.key}`).pl(6).pr(4).py(4).gap(6).items_center().rounded(6).flex_none()
          .bg(on ? t.selected : t.chrome).border(1).border_color(on ? t.accent : waiting ? color(t, s.status) : t.border)
          .hover((st) => st.bg(t.hover))
          .on_click(() => enter(s))
          .child(i < 9 ? key(`⌘${i + 1}`) : null)
          .child(div().w(8).h(8).rounded(4).bg(color(t, s.status)))
          .child(div().text_size(12).text_color(on ? t.foreground : t.muted).child(label(s)))
          .child(div().id(`x-${s.key}`).px(4).rounded(4).text_size(11).text_color(t.dim)
            .hover((st) => st.bg(t.raised).text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => { cx.stop_propagation(); askClose(s); })
            .child("✕"));
      }))
      .child(
        h_flex().id("plus").px(10).py(4).gap(6).items_center().rounded(6).flex_none()
          .hover((st) => st.bg(t.hover))
          .on_click(() => run("mod.open", { name: "tablero-ir" }))
          .child(div().text_size(12).text_color(t.accent).child("＋ Nueva"))
          .child(key("⌘K")))
      .child(div().flex_1())
      .child(h_flex().gap(10).flex_none().text_size(11).text_color(t.dim)
        .child(h_flex().gap(4).items_center().child(key("⌃Tab")).child("siguiente"))
        .child(h_flex().gap(4).items_center().child(key("⌘J")).child("la que te espera")));
  }
}
