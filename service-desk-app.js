/* =====================================================================
   Service Desk Console — application logic (core)
   ===================================================================== */
(function () {
  "use strict";
  const SD = window.__SD;
  const { SITES, ANALYSTS, CATEGORIES, PRIORITIES, STATUSES, SLA, KB, NOW } = SD;
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function timeAgo(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const h = ms / HOUR;
    if (h < 1) return `${Math.max(1, Math.round(ms / 60000))}m ago`;
    if (h < 24) return `${Math.round(h)}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }
  function hoursFmt(h) {
    if (h == null || isNaN(h)) return "—";
    const neg = h < 0; h = Math.abs(h);
    const d = Math.floor(h / 24), r = Math.floor(h % 24);
    return (neg ? "-" : "") + (d > 0 ? `${d}d ${r}h` : `${h < 1 ? h.toFixed(1) : Math.round(h)}h`);
  }
  const initials = (name) => { const a = ANALYSTS.find((x) => x.name === name); if (a) return a.initials; return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); };

  /* ---------------------- state + persistence ---------------------- */
  const LS = "gmg-sd-console-v1";
  const state = { tickets: [], assets: [] };
  function seed() {
    state.assets = SD.buildAssets();
    state.tickets = SD.buildTickets(state.assets);
    save();
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) { const d = JSON.parse(raw); if (d && d.tickets && d.assets) { state.tickets = d.tickets; state.assets = d.assets; return true; } }
    } catch (e) { /* ignore */ }
    return false;
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) { /* ignore quota */ } }

  /* ---------------------- SLA engine ---------------------- */
  const P_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const S_ORDER = { Open: 0, "In Progress": 1, "Waiting User": 2, Resolved: 3, Closed: 4 };
  function slaFor(t) {
    const target = SLA[t.priority].resolution;
    const deadline = new Date(t.created).getTime() + target * HOUR;
    const done = t.status === "Resolved" || t.status === "Closed";
    if (done) {
      const within = t.resolvedAt ? new Date(t.resolvedAt).getTime() <= deadline : true;
      return { key: within ? "met" : "breached", label: within ? "Met" : "Breached", cls: within ? "sla-ok" : "sla-breach", left: null, pct: within ? 1 : 0 };
    }
    const left = (deadline - Date.now()) / HOUR;
    if (left <= 0) return { key: "breached", label: "Breached", cls: "sla-breach", left, pct: 0 };
    const pct = Math.min(1, left / (target * 1));
    if (left <= target * 0.25) return { key: "at-risk", label: "At risk", cls: "sla-warn", left, pct };
    return { key: "ok", label: "On track", cls: "sla-ok", left, pct };
  }
  const isOpen = (t) => t.status !== "Resolved" && t.status !== "Closed";

  /* ---------------------- view state ---------------------- */
  const vs = {
    view: "dashboard",
    tickets: { q: "", status: "all", priority: "all", category: "all", assignee: "all", site: "all", sla: "all", sort: "created", dir: -1, page: 1, per: 12 },
    assets: { q: "", type: "all", status: "all", site: "all", os: "all", sort: "tag", dir: 1, page: 1, per: 12 },
    kb: { cat: "all" },
    selected: null
  };

  const TITLES = {
    dashboard: ["Dashboard", "Live service-desk overview"],
    tickets: ["Tickets", "Create, triage, assign and resolve"],
    sla: ["SLA Monitor", "Response & resolution compliance"],
    assets: ["Asset Register", "Endpoints, printers and network gear"],
    kb: ["Knowledge Base", "Resolution guides by category"]
  };

  /* ---------------------- navigation + theme ---------------------- */
  function go(view) {
    vs.view = view;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $$(".nav-item[data-goto]").forEach((b) => b.classList.toggle("active", b.dataset.goto === view));
    const [t, s] = TITLES[view]; $("#pageTitle").textContent = t; $("#pageSub").textContent = s;
    $("#sidebar").classList.remove("on"); $("#scrim").classList.remove("on");
    render(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setTheme(mode) {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("gmg-sd-theme", mode); } catch (e) {}
    const btn = $("#themeBtn");
    if (btn) btn.innerHTML = mode === "dark"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  }

  /* ---------------------- filter select builder ---------------------- */
  function fillSelect(el, opts, allLabel) {
    el.innerHTML = `<option value="all">${allLabel}</option>` + opts.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
  }

  /* ---------------------- charts (pure SVG) ---------------------- */
  function volumeChart() {
    const days = 14, buckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(NOW - i * DAY); start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + DAY);
      let created = 0, resolved = 0, breach = 0;
      state.tickets.forEach((t) => {
        const c = new Date(t.created); if (c >= start && c < end) created++;
        if (t.resolvedAt) { const r = new Date(t.resolvedAt); if (r >= start && r < end) { resolved++; if (slaFor(t).key === "breached") breach++; } }
      });
      buckets.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, created, resolved, breach });
    }
    const W = 720, H = 220, pad = 28, gap = W / days, max = Math.max(4, ...buckets.map((b) => Math.max(b.created, b.resolved)));
    const bw = gap * 0.26; let bars = "", dots = "";
    buckets.forEach((b, i) => {
      const cx = pad + i * gap + gap / 2;
      const hc = (b.created / max) * (H - pad * 2), hr = (b.resolved / max) * (H - pad * 2);
      bars += `<rect x="${cx - bw - 2}" y="${H - pad - hc}" width="${bw}" height="${hc}" rx="2" fill="var(--brand)"><title>${b.created} created</title></rect>`;
      bars += `<rect x="${cx + 2}" y="${H - pad - hr}" width="${bw}" height="${hr}" rx="2" fill="var(--ok)"><title>${b.resolved} resolved</title></rect>`;
      if (b.breach) dots += `<circle cx="${cx}" cy="${H - pad - (b.breach / max) * (H - pad * 2) - 6}" r="3.5" fill="var(--bad)"><title>${b.breach} breach</title></circle>`;
      if (i % 2 === 0) bars += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--dim)">${b.label}</text>`;
    });
    const grid = [0, 0.5, 1].map((f) => `<line x1="${pad}" y1="${pad + f * (H - pad * 2)}" x2="${W - 6}" y2="${pad + f * (H - pad * 2)}" stroke="var(--line)" stroke-dasharray="3 4"/>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}${bars}<polyline points="${buckets.map((b, i) => `${pad + i * gap + gap / 2},${H - pad - (b.breach / max) * (H - pad * 2)}`).join(" ")}" fill="none" stroke="var(--bad)" stroke-width="1.5" opacity=".55"/>${dots}</svg>`;
  }

  function gauge(pct) {
    const r = 70, cx = 90, cy = 92, circ = Math.PI * r; // semicircle
    const off = circ * (1 - pct);
    const col = pct >= 0.9 ? "var(--ok)" : pct >= 0.75 ? "var(--warn)" : "var(--bad)";
    return `<svg viewBox="0 0 180 110" style="width:100%;max-width:210px">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--panel-3)" stroke-width="16" stroke-linecap="round"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}"/>
      <text x="${cx}" y="${cy - 16}" text-anchor="middle" font-size="30" font-weight="700" fill="var(--text)" font-family="var(--mono)">${Math.round(pct * 100)}%</text>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10.5" fill="var(--dim)">within target</text>
    </svg>`;
  }

  function hBars(rows, color) {
    const max = Math.max(1, ...rows.map((r) => r.v));
    return rows.map((r) => `<div class="bar-row"><span title="${esc(r.k)}">${esc(r.k)}</span>
      <div class="track"><i style="width:${(r.v / max) * 100}%;background:${color(r)}"></i></div>
      <span class="v">${r.v}</span></div>`).join("");
  }

  /* ---------------------- KPI computation ---------------------- */
  function kpis() {
    const open = state.tickets.filter(isOpen);
    const resolved = state.tickets.filter((t) => t.status === "Resolved" || t.status === "Closed");
    const breached = state.tickets.filter((t) => slaFor(t).key === "breached");
    const atRisk = state.tickets.filter((t) => slaFor(t).key === "at-risk");
    const metCount = state.tickets.filter((t) => slaFor(t).key === "met").length;
    const doneCount = resolved.length || 1;
    const compliance = metCount / doneCount;
    const mttr = resolved.reduce((s, t) => s + (t.resolvedAt ? (new Date(t.resolvedAt) - new Date(t.created)) / HOUR : 0), 0) / doneCount;
    const week = state.tickets.filter((t) => Date.now() - new Date(t.created).getTime() < 7 * DAY).length;
    const prevWeek = state.tickets.filter((t) => { const a = Date.now() - new Date(t.created).getTime(); return a >= 7 * DAY && a < 14 * DAY; }).length;
    return { open, breached, atRisk, compliance, mttr, week, prevWeek, total: state.tickets.length };
  }

  function spark(vals) {
    const w = 96, h = 44, max = Math.max(1, ...vals);
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`).join(" ");
    return `<svg class="kpi__spk" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2"/></svg>`;
  }
  function lastWeekDaily() {
    const out = [];
    for (let i = 13; i >= 0; i--) out.push(state.tickets.filter((t) => { const a = Date.now() - new Date(t.created).getTime(); return a >= i * DAY && a < (i + 1) * DAY; }).length);
    return out;
  }

  /* ---------------------- dashboard render ---------------------- */
  function renderDashboard() {
    const k = kpis();
    const cards = [
      { lbl: "Open tickets", val: k.open.length, foot: `${k.total} total logged`, cls: "", spk: lastWeekDaily() },
      { lbl: "SLA compliance", val: Math.round(k.compliance * 100) + "%", foot: k.compliance >= 0.9 ? "target met" : "below 90% target", cls: k.compliance < 0.9 ? "alert" : "" },
      { lbl: "Breached", val: k.breached.length, foot: "need action now", cls: k.breached.length ? "alert" : "" },
      { lbl: "At risk", val: k.atRisk.length, foot: "< 25% time left", cls: k.atRisk.length ? "" : "" },
      { lbl: "Avg resolution", val: hoursFmt(k.mttr), foot: "mean time to resolve", cls: "" },
      { lbl: "This week", val: k.week, delta: k.week - k.prevWeek, foot: "vs last week", cls: "" }
    ];
    $("#kpiRow").innerHTML = cards.map((c) => {
      const d = c.delta != null ? `<span class="kpi__delta ${c.delta >= 0 ? "up" : "down"}">${c.delta >= 0 ? "▲" : "▼"} ${Math.abs(c.delta)}</span>` : "";
      return `<div class="kpi ${c.cls}">${c.spk ? spark(c.spk) : ""}<div class="kpi__lbl">${c.lbl}</div>
        <div class="kpi__val">${c.val}</div><div class="kpi__foot">${d}<span>${c.foot}</span></div></div>`;
    }).join("");

    $("#chartVolume").innerHTML = volumeChart();
    $("#chartGauge").innerHTML = gauge(k.compliance);
    const met = state.tickets.filter((t) => slaFor(t).key === "met").length;
    const br = state.tickets.filter((t) => slaFor(t).key === "breached").length;
    const ar = k.atRisk.length;
    $("#slaSplit").innerHTML = hBars([
      { k: "Met", v: met }, { k: "Breached", v: br }, { k: "At risk", v: ar }, { k: "On track", v: state.tickets.filter((t) => slaFor(t).key === "ok").length }
    ], (r) => r.k === "Met" ? "var(--ok)" : r.k === "Breached" ? "var(--bad)" : r.k === "At risk" ? "var(--warn)" : "var(--brand)");

    const catCount = {}; k.open.forEach((t) => (catCount[t.category] = (catCount[t.category] || 0) + 1));
    const cats = Object.entries(catCount).map(([a, v]) => ({ k: a, v })).sort((a, b) => b.v - a.v).slice(0, 7);
    $("#chartCats").innerHTML = cats.length ? hBars(cats, () => "var(--brand)") : `<div class="empty">No open tickets 🎉</div>`;

    const wCount = {}; k.open.forEach((t) => (wCount[t.assignee] = (wCount[t.assignee] || 0) + 1));
    const ppl = Object.entries(wCount).map(([a, v]) => ({ k: a, v })).sort((a, b) => b.v - a.v);
    $("#chartPeople").innerHTML = ppl.length ? hBars(ppl, (r) => r.k === "Unassigned" ? "var(--bad)" : "var(--gold)") : `<div class="empty">Nothing assigned</div>`;

    const rCount = {}; state.tickets.forEach((t) => (rCount[t.requester] = (rCount[t.requester] || 0) + 1));
    const req = Object.entries(rCount).map(([a, v]) => ({ k: a, v })).sort((a, b) => b.v - a.v).slice(0, 6);
    $("#chartReq").innerHTML = hBars(req, () => "var(--info)");

    const urgent = state.tickets.filter((t) => isOpen(t) && ["breached", "at-risk"].includes(slaFor(t).key))
      .sort((a, b) => slaFor(a).left - slaFor(b).left).slice(0, 6);
    $("#urgentList").innerHTML = urgent.length ? urgent.map((t) => {
      const s = slaFor(t);
      return `<div class="link-row" data-open-ticket="${t.id}" style="cursor:pointer">
        <div style="min-width:0"><b class="mono" style="color:var(--brand)">${t.id}</b> <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:34ch">${esc(t.subject)}</span></div>
        <span class="tag ${s.cls}"><i></i>${s.left <= 0 ? "breached" : hoursFmt(s.left) + " left"}</span></div>`;
    }).join("") : `<div class="empty">All tickets are within SLA ✅</div>`;
  }

  /* expose for app-ui.js */
  window.__SDCore = { state, vs, save, load, seed, slaFor, isOpen, P_ORDER, S_ORDER, go, setTheme, fillSelect, render: () => render(vs.view), fmtDate, timeAgo, hoursFmt, initials, esc, kpis, hBars, gauge, volumeChart, $, $$, ANALYSTS, CATEGORIES, PRIORITIES, STATUSES, SITES, KB, SLA };
  function render(v) {
    if (v === "dashboard") renderDashboard();
    else if (window.__SDUI && window.__SDUI[v]) window.__SDUI[v]();
  }
  window.__SDRender = render;

  document.addEventListener("DOMContentLoaded", function () {
    if (!load()) seed();
    let th = "dark"; try { th = localStorage.getItem("gmg-sd-theme") || "dark"; } catch (e) {}
    setTheme(th);
    const tick = () => { const d = new Date(); $("#clock").textContent = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " · " + String(d.getDate()).padStart(2, "0") + " " + MONTHS[d.getMonth()]; };
    tick(); setInterval(tick, 20000);
    if (window.__SDUI) window.__SDUI.wire();
    go("dashboard");
    // live SLA refresh every 60s while on a time-sensitive view
    setInterval(() => { if (["dashboard", "sla"].includes(vs.view)) render(vs.view); }, 60000);
  });
})();
