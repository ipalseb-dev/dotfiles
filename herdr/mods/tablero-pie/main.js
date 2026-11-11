// Pie de la sesión abierta: lo que antes pintaba la statusline de Claude Code.
// ~/.claude/statusline.sh escribe un JSON por terminal cuando corre dentro de Herdr.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, focused, home, readTextFile } from "herdr";

export default class Pie extends View {
  init(_props, cx) {
    this.data = {};
    this.raw = {};
    this.read(cx);
    cx.timer.every(2000, (cx) => this.read(cx));
  }

  read(cx) {
    const t = focused()?.terminal;
    if (!t) return;
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
