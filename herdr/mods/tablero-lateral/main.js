// Barra lateral dentro de una sesión: todas las sesiones, la actual marcada.
// Plegable (⌘B o «‹»): por debajo de 120 px se pinta como riel con número y estado.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, theme, focused, layout } from "herdr";
import { numbered, open, color, label, ago, askClose, LABEL } from "./sessions.js";

const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
const width = () => find(layout(), "sidebar")?.size?.px ?? 260;

export default class Lateral extends View {
  render() {
    const t = theme();
    const rail = width() < 120;
    const cur = focused()?.tab;
    const list = numbered();
    const toggle = h_flex().id("toggle").w(24).h(24).rounded(6).items_center().justify_center().flex_none()
      .text_size(14).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => run("tablero-foco.sidebar", {}))
      .child(rail ? "›" : "‹");

    if (rail) {
      return v_flex().id("root").size_full().bg(t.chrome).py(8).gap(6).items_center().overflow_hidden()
        .child(toggle)
        .children(list.map((s, i) => {
          const on = s.tab.id === cur;
          return v_flex().id(`r-${s.key}`).w(40).py(6).gap(4).items_center().rounded(8)
            .bg(on ? t.selected : t.chrome).border(1).border_color(on ? t.accent : s.status === "blocked" ? color(t, s.status) : t.chrome)
            .hover((st) => st.bg(t.hover))
            .on_click(() => open(s))
            .child(div().text_size(11).text_color(on ? t.foreground : t.muted).child(i < 9 ? `⌘${i + 1}` : `${i + 1}`))
            .child(div().w(8).h(8).rounded(4).bg(color(t, s.status)));
        }));
    }

    return v_flex().id("root").size_full().bg(t.chrome).px(8).py(8).gap(4).overflow_y_scrollbar()
      .child(h_flex().px(4).pb(6).items_center()
        .child(div().flex_1().text_size(11).font_semibold().text_color(t.dim).child(`SESIONES · ${list.length}`))
        .child(div().text_size(10).text_color(t.dim).pr(6).child("⌘B"))
        .child(toggle))
      .children(list.map((s, i) => {
        const on = s.tab.id === cur;
        const c = color(t, s.status);
        return v_flex().id(`s-${s.key}`).px(8).py(7).gap(3).rounded(8)
          .bg(on ? t.selected : t.chrome).border(1).border_color(on ? t.accent : s.status === "blocked" ? c : t.chrome)
          .hover((st) => st.bg(t.hover))
          .on_click(() => open(s))
          .child(h_flex().gap(7).items_center()
            .child(div().px(5).rounded(4).bg(t.raised).text_size(10).text_color(t.muted).child(i < 9 ? `⌘${i + 1}` : `${i + 1}`))
            .child(div().w(8).h(8).rounded(4).bg(c).flex_none())
            .child(div().flex_1().truncate().text_size(12).font_semibold().text_color(on ? t.foreground : t.muted).child(s.space.name))
            .child(div().id(`x-${s.key}`).px(4).rounded(4).text_size(11).text_color(t.dim)
              .hover((st) => st.bg(t.raised).text_color(t.foreground))
              .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
              .on_click((_e, cx) => { cx.stop_propagation(); askClose(s); })
              .child("✕")))
          .when(!!s.title, (el) => el.child(div().pl(1).truncate().text_size(12).text_color(on ? t.foreground : t.muted).child(s.title)))
          .child(h_flex().gap(6).text_size(11).text_color(t.dim)
            .child(div().text_color(c).child(s.status ? LABEL[s.status] : (s.program?.name ?? "Terminal")))
            .when(!!s.status, (el) => el.child(div().child(`· ${ago(s.since)}`))));
      }));
  }
}
