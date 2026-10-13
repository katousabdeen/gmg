/* =====================================================================
   Service Desk Console — UI rendering & interactions
   ===================================================================== */
(function () {
  "use strict";
  const C = window.__SDCore;
  const { state, vs, $, $$, esc, fmtDate, timeAgo, hoursFmt, initials, slaFor, isOpen, kpis, hBars, gauge, fillSelect, ANALYSTS, CATEGORIES, PRIORITIES, STATUSES, SITES, KB, SLA } = C;
  const PRIORITY_CLS = { Critical: "p-critical", High: "p-high", Medium: "p-medium", Low: "p-low" };
  const STATUS_CLS = { Open: "s-open", "In Progress": "s-progress", "Waiting User": "s-waiting", Resolved: "s-resolved", Closed: "s-closed" };

  function toast(msg, kind) {
    const t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.innerHTML = `<span>${esc(msg)}</span>`;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(10px)"; setTimeout(() => t.remove(), 350); }, 2600);
  }

  /* ======================= TICKETS ======================= */
  function filterTickets() {
    const f = vs.tickets, q = f.q.toLowerCase();
    let rows = state.tickets.filter((t) => {
      if (f.status !== "all" && t.status !== f.status) return false;
      if (f.priority !== "all" && t.priority !== f.priority) return false;
      if (f.category !== "all" && t.category !== f.category) return false;
      if (f.assignee !== "all" && t.assignee !== f.assignee) return false;
      if (f.site !== "all" && t.site !== f.site) return false;
      if (f.sla !== "all" && slaFor(t).key !== f.sla) return false;
      if (q) { const hay = `${t.id} ${t.subject} ${t.requester} ${t.assignee} ${t.category} ${t.site} ${t.description}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const s = f.sort, dir = f.dir;
    rows.sort((a, b) => {
      let av, bv;
      if (s === "priority") { av = C.P_ORDER[a.priority]; bv = C.P_ORDER[b.priority]; }
      else if (s === "status") { av = C.S_ORDER[a.status]; bv = C.S_ORDER[b.status]; }
      else if (s === "slaState") { av = slaFor(a).left == null ? 9999 : slaFor(a).left; bv = slaFor(b).left == null ? 9999 : slaFor(b).left; }
      else if (s === "created" || s === "resolvedAt") { av = a[s] ? new Date(a[s]).getTime() : 0; bv = b[s] ? new Date(b[s]).getTime() : 0; }
      else { av = String(a[s] || "").toLowerCase(); bv = String(b[s] || "").toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return rows;
  }

  function renderTickets() {
    const rows = filterTickets(), f = vs.tickets;
    const pages = Math.max(1, Math.ceil(rows.length / f.per));
    f.page = Math.min(f.page, pages);
    const slice = rows.slice((f.page - 1) * f.per, f.page * f.per);
    $("#resultCount").textContent = `${rows.length} ticket${rows.length === 1 ? "" : "s"}`;
    $("#ticketRows").innerHTML = slice.length ? slice.map((t) => {
      const s = slaFor(t);
      return `<tr data-open-ticket="${t.id}">
        <td class="td-id">${t.id}</td>
        <td class="td-subj"><span>${esc(t.subject)}</span><small>${esc(t.category)}${t.asset ? " · " + esc(t.asset) : ""}</small></td>
        <td><span class="tag ${PRIORITY_CLS[t.priority]}"><i></i>${t.priority}</span></td>
        <td><span class="tag ${STATUS_CLS[t.status]}">${t.status}</span></td>
        <td><span class="tag ${s.cls}">${s.label}${s.left != null && isOpen(t) ? " · " + hoursFmt(s.left) : ""}</span></td>
        <td><div class="who"><span class="avatar">${initials(t.requester)}</span><div><b>${esc(t.requester)}</b><small>${esc(t.dept)}</small></div></div></td>
        <td>${esc(t.assignee)}</td>
        <td class="dim" style="font-size:12px">${esc(t.site)}</td>
        <td class="nowrap dim" style="font-size:12px" title="${esc(t.created)}">${timeAgo(t.created)}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="9"><div class="empty">No tickets match these filters.</div></td></tr>`;
    buildPager("#ticketPager", rows.length, f, renderTickets, "tickets");
    markSort("#ticketTable", f);
  }

  /* ======================= PAGER ======================= */
  function buildPager(sel, total, f, rerender, which) {
    const pages = Math.max(1, Math.ceil(total / f.per));
    const el = $(sel);
    const btn = (p, label, dis, on) => `<button ${dis ? "disabled" : ""} class="${on ? "on" : ""}" data-page="${p}">${label}</button>`;
    let nums = "";
    const win = []; for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - f.page) <= 1) win.push(p);
    let prev = 0; win.forEach((p) => { if (prev && p - prev > 1) nums += `<span>…</span>`; nums += btn(p, p, false, p === f.page); prev = p; });
    el.innerHTML = `<span>Showing ${total ? (f.page - 1) * f.per + 1 : 0}–${Math.min(f.page * f.per, total)} of ${total}</span>
      <span class="spacer"></span>${btn(f.page - 1, "‹", f.page <= 1)}${nums}${btn(f.page + 1, "›", f.page >= pages)}
      <span style="margin-left:8px">per page</span>${[12, 25, 50].map((n) => `<button class="${n === f.per ? "on" : ""}" data-per="${n}" data-which="${which}">${n}</button>`).join("")}`;
  }
  function markSort(tblSel, f) {
    $$(`${tblSel} thead th`).forEach((th) => {
      const on = th.dataset.sort === f.sort; th.classList.toggle("sorted", on);
      const s = th.querySelector(".sort"); if (s && on) s.textContent = f.dir === 1 ? "▲" : "▼";
    });
  }

  /* ======================= TICKET DRAWER ======================= */
  function openTicket(id) {
    const t = state.tickets.find((x) => x.id === id); if (!t) return;
    vs.selected = id;
    const s = slaFor(t);
    $("#dTicketId").textContent = t.id;
    $("#dSubject").textContent = t.subject;
    const target = SLA[t.priority].resolution;
    const relatedAsset = t.asset ? state.assets.find((a) => a.tag === t.asset) : null;
    const relatedTickets = t.asset ? state.tickets.filter((x) => x.asset === t.asset && x.id !== t.id).slice(0, 4) : [];
    $("#drawerBody").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="tag ${PRIORITY_CLS[t.priority]}"><i></i>${t.priority}</span>
        <span class="tag ${STATUS_CLS[t.status]}">${t.status}</span>
        <span class="tag ${s.cls}">SLA ${s.label}${s.left != null && isOpen(t) ? " · " + (s.left <= 0 ? "overdue" : hoursFmt(s.left) + " left") : ""}</span>
        <span class="tag s-closed">${esc(t.category)}</span>
      </div>
      <div class="kv">
        <div><span>Requester</span><b>${esc(t.requester)}</b></div>
        <div><span>Department</span><b>${esc(t.dept)}</b></div>
        <div><span>Assignee</span><b>${esc(t.assignee)}</b></div>
        <div><span>Site</span><b>${esc(t.site)}</b></div>
        <div><span>Opened</span><b>${fmtDate(t.created)}</b></div>
        <div><span>Resolution target</span><b>${target}h ${t.resolvedAt ? "· done " + fmtDate(t.resolvedAt) : ""}</b></div>
      </div>
      <div><div class="kpi__lbl" style="margin-bottom:8px">Description</div><div class="desc-box">${esc(t.description)}</div></div>
      ${relatedAsset ? `<div><div class="kpi__lbl" style="margin-bottom:8px">Linked asset</div>
        <div class="link-row" data-open-asset="${relatedAsset.tag}" style="cursor:pointer"><div><b>${esc(relatedAsset.tag)}</b> · ${esc(relatedAsset.name)}</div><span class="tag ${relatedAsset.status === "In Service" ? "s-resolved" : "s-waiting"}">${esc(relatedAsset.status)}</span></div>
        ${relatedTickets.length ? `<div class="asset-mini" style="margin-top:8px">${relatedTickets.map((r) => `<div class="link-row" data-open-ticket="${r.id}" style="cursor:pointer"><span class="mono" style="color:var(--brand)">${r.id}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.subject)}</span><span class="tag ${STATUS_CLS[r.status]}">${r.status}</span></div>`).join("")}</div>` : ""}</div>` : ""}
      <div><div class="kpi__lbl" style="margin-bottom:10px">Activity</div>
        <div class="timeline">${t.activity.slice().reverse().map((a) => `
          <div class="tl ${a.type}"><i></i><div class="tl__c">
            <header><b>${esc(a.author)}</b><span>${fmtDate(a.at)}</span><span>· ${timeAgo(a.at)}</span></header>
            <p>${esc(a.text)}</p></div></div>`).join("")}</div></div>
      ${isOpen(t) ? `<div class="field"><label>Reply to user</label><textarea id="replyBox" placeholder="Type an update for ${esc(t.requester)}…"></textarea></div>` : ""}`;

    const foot = $("#drawerFoot");
    const done = !isOpen(t);
    foot.innerHTML = `
      <div class="field" style="gap:4px"><label style="font-size:10px">Status</label>
        <select id="dStatus" class="filter" style="padding:8px 10px">${STATUSES.map((o) => `<option ${o === t.status ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <div class="field" style="gap:4px"><label style="font-size:10px">Assign to</label>
        <select id="dAssign" class="filter" style="padding:8px 10px">${ANALYSTS.map((a) => `<option ${a.name === t.assignee ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>
      <div class="field" style="gap:4px"><label style="font-size:10px">Priority</label>
        <select id="dPriority" class="filter" style="padding:8px 10px">${PRIORITIES.map((a) => `<option ${a === t.priority ? "selected" : ""}>${a}</option>`).join("")}</select></div>
      ${!done ? `<button class="btn" id="dReply" style="margin-left:auto">Send reply</button><button class="btn btn--primary" id="dResolve">Mark resolved</button>` : `<button class="btn btn--primary" data-close="drawer" style="margin-left:auto">Done</button>`}`;

    $("#drawer").classList.add("on"); $("#scrim").classList.add("on");

    if (!done) {
      $("#dStatus").onchange = (e) => changeStatus(t, e.target.value);
      $("#dAssign").onchange = (e) => { t.assignee = e.target.value; log(t, e.target.value, "Ticket reassigned."); persist(t); };
      $("#dPriority").onchange = (e) => { t.priority = e.target.value; log(t, "System", `Priority changed to ${e.target.value}. Resolution target now ${SLA[e.target.value].resolution}h.`); persist(t); };
      $("#dReply").onclick = () => { const v = $("#replyBox").value.trim(); if (!v) return toast("Nothing to send", "warn"); t.activity.push({ type: "reply", author: "Mahmoud Elrawi", at: new Date().toISOString(), text: v }); persist(t); toast("Reply sent to user", "ok"); };
      $("#dResolve").onclick = () => changeStatus(t, "Resolved");
    }
  }
  function changeStatus(t, status) {
    t.status = status;
    if (status === "Resolved" || status === "Closed") { if (!t.resolvedAt) t.resolvedAt = new Date().toISOString(); log(t, "System", `Status set to ${status}.`); toast(`Ticket ${t.id} ${status.toLowerCase()}`, "ok"); }
    else { t.resolvedAt = null; log(t, "Mahmoud Elrawi", `Status changed to ${status}.`); }
    persist(t);
  }
  function log(t, author, text) { t.activity.push({ type: author === "System" ? "sys" : "status", author, at: new Date().toISOString(), text }); }
  function persist(t) { C.save(); openTicket(t.id); C.render(); refreshCounts(); }

  /* ======================= SLA VIEW ======================= */
  function renderSla() {
    const k = kpis();
    const met = state.tickets.filter((t) => slaFor(t).key === "met").length;
    const br = k.breached.length, ar = k.atRisk.length, ot = state.tickets.filter((t) => slaFor(t).key === "ok").length;
    const firstRespMet = state.tickets.filter((t) => t.activity.some((a) => a.type === "status" && /acknowledged/i.test(a.text))).length;
    $("#slaKpis").innerHTML = [
      { l: "Compliance", v: Math.round(k.compliance * 100) + "%", f: `${met} met / ${br + ar} failing`, c: k.compliance < 0.9 ? "alert" : "" },
      { l: "Breached", v: br, f: "past resolution target", c: br ? "alert" : "" },
      { l: "At risk", v: ar, f: "under 25% time left", c: "" },
      { l: "On track", v: ot, f: "open, within window", c: "" },
      { l: "First-response met", v: Math.round((firstRespMet / Math.max(1, state.tickets.length)) * 100) + "%", f: "acknowledged in time", c: "" },
      { l: "Avg resolution", v: hoursFmt(k.mttr), f: "across resolved", c: "" }
    ].map((x) => `<div class="kpi ${x.c}"><div class="kpi__lbl">${x.l}</div><div class="kpi__val">${x.v}</div><div class="kpi__foot"><span>${x.f}</span></div></div>`).join("");

    const queue = state.tickets.filter((t) => isOpen(t) && ["breached", "at-risk"].includes(slaFor(t).key))
      .sort((a, b) => slaFor(a).left - slaFor(b).left);
    $("#slaRows").innerHTML = queue.length ? queue.map((t) => {
      const s = slaFor(t);
      return `<tr data-open-ticket="${t.id}">
        <td class="td-id">${t.id}<div class="dim" style="font-size:11px;max-width:26ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.subject)}</div></td>
        <td><span class="tag ${PRIORITY_CLS[t.priority]}"><i></i>${t.priority}</span></td>
        <td class="mono" style="font-size:12px">${SLA[t.priority].resolution}h</td>
        <td><span class="tag ${s.cls}">${s.left <= 0 ? "+" + hoursFmt(-s.left) + " over" : hoursFmt(s.left)}</span></td>
        <td class="mono dim" style="font-size:12px">${hoursFmt((Date.now() - new Date(t.created)) / 3600000)}</td>
        <td><span class="tag ${STATUS_CLS[t.status]}">${t.status}</span></td>
        <td>${esc(t.assignee)}</td></tr>`;
    }).join("") : `<tr><td colspan="7"><div class="empty">No SLA risk — everything is on track ✅</div></td></tr>`;

    $("#slaPerf").innerHTML = gauge(k.compliance) + hBars([
      { k: "Met", v: met }, { k: "On track", v: ot }, { k: "At risk", v: ar }, { k: "Breached", v: br }
    ], (r) => ({ "Met": "var(--ok)", "On track": "var(--brand)", "At risk": "var(--warn)", "Breached": "var(--bad)" }[r.k]));

    const byPri = {}; PRIORITIES.forEach((p) => { const rs = state.tickets.filter((t) => t.priority === p && t.resolvedAt); if (rs.length) byPri[p] = rs.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.created)) / 3600000, 0) / rs.length; });
    $("#mttrBars").innerHTML = Object.entries(byPri).sort((a, b) => C.P_ORDER[a[0]] - C.P_ORDER[b[0]]).map(([p, v]) => ({ k: p, v: Math.round(v) })).length ?
      hBars(Object.entries(byPri).sort((a, b) => C.P_ORDER[a[0]] - C.P_ORDER[b[0]]).map(([p, v]) => ({ k: p, v: Math.round(v) })), (r) => PRIORITY_CLS[r.k] ? ({ Critical: "var(--bad)", High: "var(--warn)", Medium: "var(--med)", Low: "var(--ok)" }[r.k]) : "var(--brand)")
      : `<div class="empty">No resolved tickets yet</div>`;
  }

  /* ======================= ASSETS ======================= */
  function openTicketsFor(tag) { return state.tickets.filter((t) => t.asset === tag && isOpen(t)).length; }
  function filterAssets() {
    const f = vs.assets, q = f.q.toLowerCase();
    let rows = state.assets.filter((a) => {
      if (f.type !== "all" && a.type !== f.type) return false;
      if (f.status !== "all" && a.status !== f.status) return false;
      if (f.site !== "all" && a.site !== f.site) return false;
      if (f.os !== "all" && a.os !== f.os) return false;
      if (q) { const hay = `${a.tag} ${a.name} ${a.type} ${a.assignedTo} ${a.site} ${a.serial}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    });
    const s = f.sort, dir = f.dir;
    rows.sort((a, b) => {
      let av, bv;
      if (s === "health") { av = a.health; bv = b.health; }
      else if (s === "warrantyEnd") { av = new Date(a.warrantyEnd).getTime(); bv = new Date(b.warrantyEnd).getTime(); }
      else if (s === "tickets") { av = openTicketsFor(a.tag); bv = openTicketsFor(b.tag); }
      else { av = String(a[s] || "").toLowerCase(); bv = String(b[s] || "").toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return rows;
  }
  function healthColor(h) { return h >= 80 ? "var(--ok)" : h >= 60 ? "var(--brand)" : h >= 40 ? "var(--warn)" : "var(--bad)"; }
  function warrantyState(iso) { const d = (new Date(iso) - Date.now()) / 86400000; if (d < 0) return { t: "Expired", c: "warranty-bad" }; if (d < 90) return { t: `${Math.round(d)}d left`, c: "warranty-warn" }; return { t: new Date(iso).toISOString().slice(0, 10), c: "" }; }
  function renderAssets() {
    const rows = filterAssets(), f = vs.assets;
    const pages = Math.max(1, Math.ceil(rows.length / f.per)); f.page = Math.min(f.page, pages);
    const slice = rows.slice((f.page - 1) * f.per, f.page * f.per);
    $("#assetCount").textContent = `${rows.length} asset${rows.length === 1 ? "" : "s"}`;
    $("#assetRows").innerHTML = slice.length ? slice.map((a) => {
      const w = warrantyState(a.warrantyEnd), ot = openTicketsFor(a.tag);
      const dots = Array.from({ length: 5 }, (_, i) => `<i style="background:${a.health >= (i + 1) * 20 ? healthColor(a.health) : "var(--panel-3)"}"></i>`).join("");
      return `<tr data-open-asset="${a.tag}">
        <td class="td-id">${esc(a.tag)}</td>
        <td class="td-subj"><span>${esc(a.name)}</span><small>${esc(a.serial)}</small></td>
        <td>${esc(a.type)}</td><td class="dim" style="font-size:12px">${esc(a.os)}</td>
        <td><div class="who"><span class="avatar">${initials(a.assignedTo)}</span><div><b>${esc(a.assignedTo)}</b><small>${esc(a.assignedDept)}</small></div></div></td>
        <td class="dim" style="font-size:12px">${esc(a.site)}</td>
        <td><span class="tag ${a.status === "In Service" ? "s-resolved" : a.status === "Maintenance" ? "s-waiting" : a.status === "Retired" || a.status === "Lost / Stolen" ? "s-closed" : "s-progress"}">${esc(a.status)}</span></td>
        <td><div class="cond-bar" title="health ${a.health}%">${dots}</div></td>
        <td class="${w.c}" style="font-size:12px">${w.t}</td>
        <td>${ot ? `<span class="tag ${ot > 1 ? "p-high" : "p-medium"}">${ot}</span>` : `<span class="dim">—</span>`}</td></tr>`;
    }).join("") : `<tr><td colspan="10"><div class="empty">No assets match these filters.</div></td></tr>`;
    buildPager("#assetPager", rows.length, f, renderAssets, "assets");
    markSort("#assetTable", f);
  }
  function openAsset(tag) {
    const a = state.assets.find((x) => x.tag === tag); if (!a) return;
    const tix = state.tickets.filter((t) => t.asset === tag).sort((x, y) => new Date(y.created) - new Date(x.created));
    const w = warrantyState(a.warrantyEnd);
    $("#dTicketId").textContent = a.tag; $("#dSubject").textContent = a.name;
    $("#drawerBody").innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="tag ${a.status === "In Service" ? "s-resolved" : "s-waiting"}">${esc(a.status)}</span>
        <span class="tag s-progress">${esc(a.type)}</span>
        <span class="tag ${w.c === "warranty-bad" ? "p-critical" : w.c === "warranty-warn" ? "p-medium" : "s-closed"}">Warranty: ${w.t}</span></div>
      <div class="kv">
        <div><span>Serial</span><b class="mono">${esc(a.serial)}</b></div>
        <div><span>OS / firmware</span><b>${esc(a.os)}</b></div>
        <div><span>Assigned to</span><b>${esc(a.assignedTo)}</b></div>
        <div><span>Department</span><b>${esc(a.assignedDept)}</b></div>
        <div><span>Site</span><b>${esc(a.site)}</b></div>
        <div><span>Purchased</span><b>${esc(a.purchase)}</b></div>
      </div>
      <div><div class="kpi__lbl" style="margin-bottom:8px">Endpoint health · ${a.health}%</div>
        <div class="progress-bar"><i style="width:${a.health}%;background:${healthColor(a.health)}"></i></div>
        <div class="dim" style="font-size:12px;margin-top:8px">Last patch: ${fmtDate(a.lastPatch)}</div></div>
      <div><div class="kpi__lbl" style="margin-bottom:10px">Related tickets (${tix.length})</div>
        ${tix.length ? `<div class="asset-mini">${tix.map((t) => `<div class="link-row" data-open-ticket="${t.id}" style="cursor:pointer"><span class="mono" style="color:var(--brand)">${t.id}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.subject)}</span><span class="tag ${STATUS_CLS[t.status]}">${t.status}</span></div>`).join("")}</div>` : `<div class="empty">No tickets on this asset.</div>`}</div>`;
    $("#drawerFoot").innerHTML = `<button class="btn" id="aNewTicket" data-asset="${esc(a.tag)}">Raise ticket for this asset</button><button class="btn btn--primary" data-close="drawer" style="margin-left:auto">Close</button>`;
    $("#aNewTicket").onclick = () => { $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); openNewTicket(a); };
    $("#drawer").classList.add("on"); $("#scrim").classList.add("on");
  }

  /* ======================= KNOWLEDGE BASE ======================= */
  function renderKb() {
    const cat = vs.kb.cat;
    const items = KB.filter((a) => cat === "all" || a.cat === cat);
    $("#kbGrid").innerHTML = items.map((a) => `
      <button class="kb-card" data-kb="${a.id}">
        <span class="kb-card__ic">${a.icon}</span>
        <h4>${esc(a.title)}</h4>
        <p>${esc(a.summary)}</p>
        <div class="kb-card__meta"><span class="tag s-progress">${esc(a.cat)}</span><span class="tag s-closed">${a.steps.length} steps</span></div>
      </button>`).join("");
  }
  function openKb(id) {
    const a = KB.find((x) => x.id === id); if (!a) return;
    $("#modalTitle").textContent = a.title;
    $("#modalBody").innerHTML = `
      <p class="dim">${esc(a.summary)}</p>
      <div class="callout info"><b>Applies to:</b> ${esc(a.cat)} · first-line and L2 resolution path.</div>
      <div class="steps">${a.steps.map((s) => `<div class="step"><div class="step__c"><h5>${esc(s.h)}</h5><p>${esc(s.p)}</p></div></div>`).join("")}</div>
      ${a.cmds && a.cmds.length ? `<div><div class="kpi__lbl" style="margin-bottom:8px">Useful commands</div>${a.cmds.map((c) => `<code class="cmd">${esc(c)}<button data-copy="${esc(c)}">copy</button></code>`).join("")}</div>` : ""}
      <div class="callout ok"><b>Close the loop:</b> confirm with the user, record the resolution note on the ticket, and link any related asset.</div>`;
    $("#modalFoot").innerHTML = `<button class="btn" data-close="modal">Close</button>`;
    openModal();
  }

  /* ======================= MODAL: NEW TICKET ======================= */
  function openNewTicket(asset) {
    const assetOpts = state.assets.map((a) => `<option value="${esc(a.tag)}" ${asset && a.tag === asset.tag ? "selected" : ""}>${esc(a.tag)} — ${esc(a.name)}</option>`).join("");
    $("#modalTitle").textContent = asset ? "Raise ticket · " + asset.tag : "New service ticket";
    $("#modalBody").innerHTML = `<form id="ntForm">
      <div class="grid-form">
        <div class="field" style="grid-column:1/-1"><label>Subject *</label><input name="subject" required placeholder="Short summary of the issue"></div>
        <div class="field"><label>Requester *</label><input name="requester" required placeholder="Full name" value="${asset ? esc(asset.assignedTo) : ""}"></div>
        <div class="field"><label>Department</label><select name="dept">${["Retail Operations", "Logistics / Trilogi", "Finance", "Human Resources", "Merchandising", "Marketing", "Supply Chain", "Corporate IT"].map((d) => `<option ${asset && d === asset.assignedDept ? "selected" : ""}>${d}</option>`).join("")}</select></div>
        <div class="field"><label>Site</label><select name="site">${SITES.map((s) => `<option ${asset && s === asset.site ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
        <div class="field"><label>Category</label><select name="category">${CATEGORIES.map((c) => `<option ${asset && c === "Laptop / Desktop" ? "" : ""}>${c}</option>`).join("")}</select></div>
        <div class="field"><label>Priority</label><select name="priority">${PRIORITIES.map((p, i) => `<option ${i === 2 ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label>Assign to</label><select name="assignee">${ANALYSTS.map((a) => `<option>${a.name}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Linked asset (optional)</label><select name="asset"><option value="">— none —</option>${assetOpts}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Description *</label><textarea name="description" required placeholder="What happened, where, and impact on trading…"></textarea></div>
      </div></form>`;
    $("#modalFoot").innerHTML = `<button class="btn" data-close="modal">Cancel</button><button class="btn btn--primary" id="ntSubmit">Create ticket</button>`;
    openModal();
    $("#ntSubmit").onclick = () => {
      const f = new FormData($("#ntForm")); const subject = (f.get("subject") || "").trim();
      if (!subject) return toast("Subject is required", "warn");
      const priority = f.get("priority"), now = new Date().toISOString();
      const num = 2400 + state.tickets.length + 1;
      const t = {
        id: "TKT-" + num, subject, description: f.get("description") || subject, category: f.get("category"), priority,
        status: "Open", requester: f.get("requester") || "Walk-in user", dept: f.get("dept"), site: f.get("site"),
        assignee: f.get("assignee"), asset: f.get("asset") || null, resolvedAt: null,
        kbRef: null, tags: [f.get("category").split(" ")[0].toLowerCase()],
        activity: [{ type: "sys", author: "System", at: now, text: `Ticket created via self-service portal · priority ${priority} · ${f.get("site")}.` }]
      };
      state.tickets.unshift(t); C.save(); closeModal(); refreshCounts(); C.render();
      toast(`Ticket ${t.id} created`, "ok");
      setTimeout(() => openTicket(t.id), 200);
    };
  }

  /* ======================= MODAL: NEW ASSET ======================= */
  function openNewAsset() {
    $("#modalTitle").textContent = "Register asset";
    $("#modalBody").innerHTML = `<form id="naForm"><div class="grid-form">
      <div class="field"><label>Device / model *</label><input name="name" required placeholder="e.g. Dell Latitude 5440"></div>
      <div class="field"><label>Type</label><select name="type">${SD_TYPES()}</select></div>
      <div class="field"><label>OS / firmware</label><select name="os">${SD_OS()}</select></div>
      <div class="field"><label>Serial *</label><input name="serial" required placeholder="SN…"></div>
      <div class="field"><label>Assigned to</label><input name="assignedTo" placeholder="User or IT Store Room"></div>
      <div class="field"><label>Department</label><select name="assignedDept">${["Retail Operations", "Logistics / Trilogi", "Finance", "Human Resources", "Merchandising", "Marketing", "Supply Chain", "Corporate IT"].map((d) => `<option>${d}</option>`).join("")}</select></div>
      <div class="field"><label>Site</label><select name="site">${SITES.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label><select name="status">${["In Service", "In Stock", "Maintenance", "Retired", "Lost / Stolen"].map((s) => `<option>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Warranty end</label><input type="date" name="warrantyEnd" value="${new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Health % (patch/compliance)</label><input type="number" name="health" min="0" max="100" value="92"></div>
    </div></form>`;
    $("#modalFoot").innerHTML = `<button class="btn" data-close="modal">Cancel</button><button class="btn btn--primary" id="naSubmit">Add asset</button>`;
    openModal();
    $("#naSubmit").onclick = () => {
      const f = new FormData($("#naForm")); const name = (f.get("name") || "").trim();
      if (!name) return toast("Device name is required", "warn");
      const n = 1000 + state.assets.length;
      const a = {
        id: "AST-" + n, tag: "GMG-" + (f.get("type") || "DEV").slice(0, 2).toUpperCase() + "-" + (4900 + state.assets.length),
        name, type: f.get("type"), os: f.get("os"), serial: f.get("serial") || "SN-", site: f.get("site"),
        assignedTo: f.get("assignedTo") || "IT Store Room", assignedDept: f.get("assignedDept"),
        status: f.get("status"), health: Math.max(0, Math.min(100, Number(f.get("health")) || 100)),
        purchase: new Date().toISOString().slice(0, 10), warrantyEnd: f.get("warrantyEnd") || new Date().toISOString().slice(0, 10),
        lastPatch: new Date().toISOString(), notes: ""
      };
      state.assets.unshift(a); C.save(); closeModal(); go("assets"); renderAssets();
      toast(`Asset ${a.tag} registered`, "ok");
    };
  }
  const SD_TYPES = () => ["Laptop", "Desktop", "Monitor", "Printer", "Mobile Phone", "Tablet", "POS Terminal", "Router / Switch"].map((t) => `<option>${t}</option>`).join("");
  const SD_OS = () => ["Windows 11 Pro", "Windows 10 Pro", "macOS Sonoma", "macOS Ventura", "iPadOS 17", "Android 14", "Firmware"].map((t) => `<option>${t}</option>`).join("");

  /* ======================= MODAL helpers ======================= */
  function openModal() { $("#modal").classList.add("on"); $("#scrim").classList.add("on"); }
  function closeAll() { $("#modal").classList.remove("on"); $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }

  /* ======================= CSV export ======================= */
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCsv() {
    if (vs.view === "assets") {
      const head = ["Tag", "Name", "Type", "OS", "Serial", "AssignedTo", "Dept", "Site", "Status", "Health", "WarrantyEnd", "OpenTickets"];
      const body = filterAssets().map((a) => [a.tag, a.name, a.type, a.os, a.serial, a.assignedTo, a.assignedDept, a.site, a.status, a.health, a.warrantyEnd, openTicketsFor(a.tag)].map(csvCell).join(","));
      download("asset-register.csv", [head.join(","), ...body].join("\n")); return;
    }
    const head = ["Ticket", "Subject", "Category", "Priority", "Status", "SLA", "Requester", "Assignee", "Site", "Created", "Resolved"];
    const body = filterTickets().map((t) => [t.id, t.subject, t.category, t.priority, t.status, slaFor(t).label, t.requester, t.assignee, t.site, t.created, t.resolvedAt || ""].map(csvCell).join(","));
    download("tickets-export.csv", [head.join(","), ...body].join("\n"));
  }
  function download(name, text) {
    const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); toast("Exported " + name, "ok");
  }

  /* ======================= counts / badges ======================= */
  function refreshCounts() { $("#navOpen").textContent = state.tickets.filter(isOpen).length; }

  /* ======================= WIRE events ======================= */
  function wire() {
    fillSelect($("#fStatus"), STATUSES, "All statuses");
    fillSelect($("#fPriority"), PRIORITIES, "All priorities");
    fillSelect($("#fCategory"), CATEGORIES, "All categories");
    fillSelect($("#fAssignee"), ANALYSTS.map((a) => a.name), "All analysts");
    fillSelect($("#fSite"), SITES, "All sites");
    fillSelect($("#fSla"), ["met", "ok", "at-risk", "breached"], "Any SLA state");
    fillSelect($("#aType"), ["Laptop", "Desktop", "Monitor", "Printer", "Mobile Phone", "Tablet", "POS Terminal", "Router / Switch"], "All types");
    fillSelect($("#aStatus"), ["In Service", "In Stock", "Maintenance", "Retired", "Lost / Stolen"], "All status");
    fillSelect($("#aSite"), SITES, "All sites");
    fillSelect($("#aOs"), ["Windows 11 Pro", "Windows 10 Pro", "macOS Sonoma", "macOS Ventura", "iPadOS 17", "Android 14", "Firmware"], "All OS");
    fillSelect($("#kCat"), Array.from(new Set(KB.map((a) => a.cat))), "All categories");

    document.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-goto]"); if (nav) { e.preventDefault(); C.go(nav.dataset.goto); return; }
      const act = e.target.closest("[data-action]");
      if (act) { const a = act.dataset.action; if (a === "new-ticket") openNewTicket(); else if (a === "new-asset") openNewAsset(); else if (a === "export") exportCsv(); return; }
      const close = e.target.closest("[data-close]"); if (close) { closeAll(); return; }
      const tRow = e.target.closest("[data-open-ticket]"); if (tRow && !e.target.closest("[data-copy]")) { openTicket(tRow.dataset.openTicket); return; }
      const aRow = e.target.closest("[data-open-asset]"); if (aRow) { openAsset(aRow.dataset.openAsset); return; }
      const kb = e.target.closest("[data-kb]"); if (kb) { openKb(kb.dataset.kb); return; }
      const copy = e.target.closest("[data-copy]"); if (copy) { navigator.clipboard && navigator.clipboard.writeText(copy.dataset.copy); toast("Copied", "ok"); e.stopPropagation(); return; }
      const th = e.target.closest("th[data-sort]");
      if (th) { const f = vs.view === "assets" ? vs.assets : vs.tickets; const key = th.dataset.sort; if (f.sort === key) f.dir *= -1; else { f.sort = key; f.dir = 1; } render(vs.view); return; }
      const pg = e.target.closest("[data-page]"); if (pg && !pg.disabled) { const which = pg.closest("#assetPager") ? "assets" : "tickets"; vs[which].page = Number(pg.dataset.page); render(which); return; }
      const per = e.target.closest("[data-per]"); if (per) { const which = per.dataset.which; vs[which].per = Number(per.dataset.per); vs[which].page = 1; render(which); return; }
      if (e.target === $("#scrim")) { closeAll(); $("#sidebar").classList.remove("on"); }
    });

    const bind = (sel, key, prop) => { const el = $(sel); if (!el) return; el.addEventListener("change", () => { vs[key][prop] = el.value; vs[key].page = 1; render(key); }); };
    bind("#fStatus", "tickets", "status"); bind("#fPriority", "tickets", "priority"); bind("#fCategory", "tickets", "category");
    bind("#fAssignee", "tickets", "assignee"); bind("#fSite", "tickets", "site"); bind("#fSla", "tickets", "sla");
    bind("#aType", "assets", "type"); bind("#aStatus", "assets", "status"); bind("#aSite", "assets", "site"); bind("#aOs", "assets", "os");
    $("#kCat").addEventListener("change", () => { vs.kb.cat = $("#kCat").value; renderKb(); });

    $("#clearFilters").onclick = () => { Object.assign(vs.tickets, { q: "", status: "all", priority: "all", category: "all", assignee: "all", site: "all", sla: "all", page: 1 }); ["#fStatus", "#fPriority", "#fCategory", "#fAssignee", "#fSite", "#fSla"].forEach((s) => ($(s).value = "all")); $("#globalSearch").value = ""; render("tickets"); };
    $("#clearAssetFilters").onclick = () => { Object.assign(vs.assets, { q: "", type: "all", status: "all", site: "all", os: "all", page: 1 }); ["#aType", "#aStatus", "#aSite", "#aOs"].forEach((s) => ($(s).value = "all")); $("#globalSearch").value = ""; render("assets"); };

    $("#globalSearch").addEventListener("input", (e) => { const q = e.target.value; if (vs.view === "assets") { vs.assets.q = q; vs.assets.page = 1; renderAssets(); } else { vs.tickets.q = q; vs.tickets.page = 1; if (vs.view !== "tickets") C.go("tickets"); renderTickets(); } });

    $("#menuBtn").onclick = () => { $("#sidebar").classList.add("on"); $("#scrim").classList.add("on"); };
    $("#themeBtn").onclick = () => C.setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $("#globalSearch").focus(); }
    });

    refreshCounts();
  }

  function render(v) { C.render(v); }
  window.__SDUI = {
    wire, tickets: renderTickets, sla: renderSla, assets: renderAssets, kb: renderKb, dashboard: () => {},
    toast, refreshCounts
  };
})();
