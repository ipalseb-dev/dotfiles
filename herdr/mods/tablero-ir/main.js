// ⌘K: ir a una sesión abierta o abrir una nueva.
// Paso 1: sesión abierta o carpeta. Paso 2 (solo si aporta): tarea de Pulse y dónde (misma carpeta / worktree).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { run, theme, spaces, props, closeOverlay, pickFolder, notify } from "herdr";
import { sessions, open, color, label, LABEL } from "./sessions.js";
import { loadProjects, named, sorted } from "./projects.js";
import { pulseProjectFor, openTasks } from "./pulse.js";
import { isGit, makeWorktree, slug } from "./worktree.js";

const norm = (s) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const STATUS = { IN_PROGRESS: "en curso", BLOCKED: "bloqueada", PENDING: "pendiente", IN_REVIEW: "en revisión" };
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `sesion-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

export default class TableroIr extends View {
  init(_props, cx) {
    this.filter = "";
    this.at = 0;
    // Sin campo de texto: un Input se queda ↑/↓ para mover su cursor y la lista nunca los recibía.
    // El foco lo tiene el contenedor y lo que se escribe se recoge tecla a tecla.
    this.handle = cx.focus_handle();
    this.scroller = ScrollHandle.new(); // para que la opción marcada no se salga de la vista
    this.itemOf = [];
    this.step2 = null; // { p, space, tasks, loading, git, worktree }
    this.projects = [];
    cx.spawn(async (cx) => {
      try {
        const { pinned, list } = await loadProjects();
        this.projects = [...pinned, ...sorted(list)];
        cx.notify();
        this.projects = [...pinned, ...sorted(await named(list))];
      } catch {}
      cx.notify();
    });
    this.handle.focus();
    cx.timer.after(150, () => this.handle.focus());
    cx.timer.after(500, () => this.handle.focus());
  }

  close() { closeOverlay(props()?.overlay); }

  spaceFor(p) {
    const sp = spaces();
    return sp.find((x) => x.folder === p.folder) ?? sp.find((x) => x.name === p.name) ?? null;
  }

  rows() {
    const words = norm(this.filter).split(/\s+/).filter(Boolean);
    const match = (text) => words.every((w) => norm(text).includes(w));
    if (this.step2) {
      const s2 = this.step2;
      const tasks = (s2.tasks ?? []).filter((x) => match(`${x.ref} ${x.title}`)).map((x) => ({ kind: "task", task: x, text: `${x.ref} ${x.title}` }));
      return [{ kind: "task", task: null, text: "Sin tarea" }, ...tasks];
    }
    const open_ = sessions().filter((s) => match(`${label(s)} ${s.cwd ?? ""}`)).map((s) => ({ kind: "open", s, text: label(s) }));
    const nuevas = this.projects.filter((p) => match(`${p.name} ${p.dir ?? ""}`)).map((p) => ({ kind: "new", p, text: p.name }));
    return [...open_, ...nuevas, { kind: "folder", text: "Otra carpeta…" }];
  }

  pick(r, cx) {
    if (!r) return;
    if (r.kind === "open") { this.close(); open(r.s); this.toFocus(); return; }
    if (r.kind === "folder") {
      this.close();
      pickFolder({ prompt: "Carpeta del proyecto" }).then((folder) => {
        if (folder) { run("space.new", { folder, argv: ["claude"] }); this.toFocus(); }
      });
      return;
    }
    if (r.kind === "task") { this.launch(this.step2, r.task); return; }
    // Proyecto: mira si hay algo que preguntar antes de crear.
    const p = r.p, space = this.spaceFor(p);
    const busy = sessions().some((s) => s.space.id === space?.id);
    this.step2 = { p, space, tasks: null, loading: true, git: false, worktree: false };
    this.filter = ""; this.at = 0;
    cx.notify();
    cx.spawn(async (cx) => {
      const [git, proj] = await Promise.all([isGit(p.folder), pulseProjectFor(p.folder).catch(() => null)]);
      let tasks = [];
      if (proj) tasks = await openTasks(proj.key).catch(() => []);
      Object.assign(this.step2, { git: git && !p.pinned, tasks, key: proj?.key, loading: false });
      // Nada que elegir: ni tareas ni otra sesión en el repo → directo.
      if (!tasks.length && !(busy && this.step2.git)) { this.launch(this.step2, null); return; }
      cx.notify();
    });
  }

  launch(s2, task) {
    this.close();
    const name = task ? `${task.ref} ${task.title}`.slice(0, 48) : undefined;
    const argv = task
      ? ["claude", `Vamos a trabajar en la tarea de Pulse ${task.ref}: «${task.title}». Léela con get_task para tener el contexto y espera mis indicaciones antes de tocar nada.`]
      : ["claude"];
    const go = (folder) => {
      if (s2.space) run("tab.new", { space: s2.space.id, folder, argv, ...(name ? { name } : {}) });
      else run("space.new", { name: s2.p.name, folder, argv, ...(name ? { tab: name } : {}) });
      this.toFocus();
    };
    if (!(s2.worktree && s2.git)) { go(s2.p.folder); return; }
    const branch = task ? `${task.ref}-${slug(task.title)}` : stamp();
    makeWorktree(s2.p.folder, branch)
      .then(({ path, base }) => {
        notify({ title: `Worktree ${branch}`, body: `Desde ${base}. Ojo: no trae node_modules ni .env; instálalos si los necesitas.`, level: "info", timeout: 8000 });
        go(path);
      })
      .catch((e) => notify({ title: "No se pudo crear el worktree", body: String(e.message ?? e), level: "error", timeout: 10000 }));
  }

  toFocus() { run("layout.select", { stack: "vista", child: "foco" }); }

  render(cx) {
    const t = theme();
    const rows = this.rows();
    if (this.at >= rows.length) this.at = 0;
    const s2 = this.step2;
    const counts = {};
    for (const s of sessions()) counts[s.space.id] = (counts[s.space.id] ?? 0) + 1;
    const section = (txt) => div().px(14).pt(10).pb(4).text_size(11).font_semibold().text_color(t.dim).child(txt);
    const items = [];
    let last = null;
    rows.forEach((r, i) => {
      const kind = r.kind === "task" ? (r.task ? "task" : "none") : r.kind;
      if (kind !== last) {
        const titles = { open: "ABIERTAS · ir a la sesión", new: "NUEVA SESIÓN EN… · arranca Claude en esa carpeta", folder: "FUERA DE PROJECTS",
          none: "SESIÓN LIBRE", task: `TAREAS DE PULSE${s2?.key ? ` · ${s2.key}` : ""} · Claude arranca con su contexto` };
        items.push(section(titles[kind]));
        last = kind;
      }
      this.itemOf[i] = items.length;
      const sel = i === this.at;
      const row = h_flex().id(`r-${i}`).mx(6).px(10).py(7).gap(10).items_center().rounded(6)
        .bg(sel ? t.selected : t.popover).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.pick(r, cx));
      if (r.kind === "open") {
        row.child(div().w(8).h(8).rounded(4).bg(color(t, r.s.status)))
          .child(div().flex_1().truncate().text_size(13).text_color(t.foreground).child(r.text))
          .child(div().text_size(11).text_color(t.dim).child(LABEL[r.s.status] ?? ""));
      } else if (r.kind === "task") {
        row.child(div().text_size(14).text_color(t.accent).child(r.task ? "◆" : "＋"))
          .child(div().flex_1().truncate().text_size(13).text_color(t.foreground).child(r.task ? r.task.title : "Sin tarea: solo abrir Claude"))
          .when(!!r.task, (el) => el.child(div().text_size(11).text_color(t.muted).child(r.task.ref))
            .child(div().w(80).text_size(11).text_color(r.task.status === "IN_PROGRESS" ? t.working : r.task.status === "BLOCKED" ? t.blocked : t.dim).child(STATUS[r.task.status] ?? r.task.status)));
      } else {
        const sp = r.p ? this.spaceFor(r.p) : null;
        row.child(div().text_size(14).text_color(t.accent).child("＋"))
          .child(div().flex_1().truncate().text_size(13).text_color(r.p ? t.foreground : t.muted).child(r.text))
          .when(!!r.p?.dir && r.p.dir !== r.text, (el) => el.child(div().text_size(11).text_color(t.dim).child(r.p.dir)))
          .when(!!sp && !!counts[sp.id], (el) => el.child(div().text_size(11).text_color(t.accent).child(`ya hay ${counts[sp.id]} abierta${counts[sp.id] > 1 ? "s" : ""}`)));
      }
      items.push(row);
    });

    const where = (wt, txt) => h_flex().id(`w-${wt}`).px(10).py(4).rounded(6).text_size(12)
      .bg(s2?.worktree === wt ? t.selected : t.popover).border(1).border_color(s2?.worktree === wt ? t.accent : t.border)
      .text_color(s2?.worktree === wt ? t.foreground : t.muted).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { s2.worktree = wt; cx.notify(); }).child(txt);

    return v_flex().id("root").size_full().bg(t.popover)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        const m = e.modifiers ?? {};
        if (e.key === "escape") { if (s2) { this.step2 = null; this.filter = ""; this.at = 0; } else this.close(); }
        else if (e.key === "down") this.at = (this.at + 1) % rows.length;
        else if (e.key === "up") this.at = (this.at + rows.length - 1) % rows.length;
        else if (e.key === "enter") { this.pick(rows[this.at], cx); }
        else if (e.key === "tab") { if (s2?.git) s2.worktree = !s2.worktree; }
        else if (e.key === "backspace") { this.filter = m.platform || m.alt ? "" : this.filter.slice(0, -1); this.at = 0; }
        else if (e.key_char && !m.platform && !m.control && e.key_char.length === 1 && e.key_char >= " ") { this.filter += e.key_char; this.at = 0; }
        else return;
        if (e.key === "down" || e.key === "up") this.scroller.scroll_to_item(this.itemOf[this.at] ?? 0);
        cx.stop_propagation(); cx.notify();
      })
      .when(!!s2, (el) => el.child(h_flex().px(14).py(8).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().id("back").text_size(12).text_color(t.dim).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => { this.step2 = null; this.filter = ""; this.at = 0; cx.notify(); }).child("← Esc"))
        .child(div().flex_1().text_size(14).font_semibold().text_color(t.foreground).child(s2.p.name))
        .when(s2.git, (el) => el.child(div().text_size(11).text_color(t.dim).child("Tab:"))
          .child(where(false, "Misma carpeta")).child(where(true, "Worktree nuevo")))))
      .child(h_flex().h(44).px(14).gap(1).items_center().border_b(1).border_color(t.border).text_size(14)
        .when(!this.filter, (el) => el.child(div().w(2).h(18).bg(t.accent).loop("opacity", { from: 0.2, to: 1, period: 1000 }))
          .child(div().pl(4).text_color(t.dim).child(s2 ? "Filtra tareas…" : "Escribe un proyecto o una sesión…")))
        .when(!!this.filter, (el) => el.child(div().text_color(t.foreground).child(this.filter))
          .child(div().w(2).h(18).bg(t.accent).loop("opacity", { from: 0.2, to: 1, period: 1000 }))))
      .child(v_flex().id("list").h(420).pb(8).overflow_y_scrollbar().track_scroll(this.scroller)
        .when(!!s2?.loading, (el) => el.child(div().p(14).text_size(12).text_color(t.dim).child("Mirando tareas en Pulse…")))
        .when(!s2?.loading, (el) => el.children(items)))
      .child(h_flex().px(14).py(8).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child("↑↓ moverse").child("↵ abrir").child(s2 ? "Esc volver" : "Esc cerrar").when(!!s2?.git, (el) => el.child("Tab misma carpeta / worktree")));
  }
}
