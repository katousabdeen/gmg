/* =====================================================================
   Service Desk Console — self-contained demo application
   Independent build. Not an official GMG system. All data is synthetic.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------------- seeded RNG (stable demo data) ---------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261014);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const randInt = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
  const chance = (p) => rnd() < p;

  /* ---------------------- reference data ---------------------- */
  const SITES = [
    "Dubai HQ — Sheikh Zayed Rd", "Dubai Mall — Sports Store", "Mall of the Emirates",
    "Abu Dhabi — Yas Island", "Sharjah — Sahara Centre", "Riyadh — Kingdom Tower",
    "Jeddah — Red Sea Mall", "Kuwait — Avenues", "Doha — Lagoona", "Manama — City Centre",
    "Kuala Lumpur — Pavilion", "Jakarta — Grand Indonesia", "Hong Kong — Times Square"
  ];
  const DEPTS = ["Retail Operations", "Logistics / Trilogi", "Finance", "Human Resources",
    "Merchandising", "Marketing", "Store Management", "Supply Chain", "Corporate IT"];
  const ANALYSTS = [
    { name: "Mahmoud Elrawi", role: "Service Desk Analyst", initials: "ME" },
    { name: "Sara Haddad", role: "L2 Support Engineer", initials: "SH" },
    { name: "Omar Farouk", role: "Field IT Technician", initials: "OF" },
    { name: "Priya Nair", role: "Endpoint & M365 Admin", initials: "PN" },
    { name: "Daniel Cruz", role: "Network Technician", initials: "DC" },
    { name: "Unassigned", role: "—", initials: "?" }
  ];
  const CATEGORIES = ["Account & Access", "Microsoft 365", "VPN & Remote Access", "Network & Wi-Fi",
    "Printer & Scanning", "Laptop / Desktop", "Phone & Mobility", "Software Application",
    "Email Issues", "Peripherals", "Warranty & Repair"];
  const PRIORITIES = ["Critical", "High", "Medium", "Low"];
  const STATUSES = ["Open", "In Progress", "Waiting User", "Resolved", "Closed"];

  const REQUESTERS = [
    "Layla Mansour", "Khalid Al Otaibi", "Fatima Zahra", "John Miller", "Ananya Rao",
    "Mohamed Saleh", "Grace Lim", "Tarek Nasser", "Huda Kareem", "Ravi Menon",
    "Sultan Al Marri", "Elena Petrova", "Yousef Haddad", "Mariam Saeed", "Carlos Mendes",
    "Noura Al Sabah", "Amit Sharma", "Reem Khalil", "Victor Ng", "Aisha Binte Omar"
  ];

  /* SLA matrix — first response & resolution, in calendar hours */
  const SLA = {
    Critical: { response: 1, resolution: 4 },
    High: { response: 4, resolution: 8 },
    Medium: { response: 8, resolution: 24 },
    Low: { response: 24, resolution: 72 }
  };

  const OS_LIST = ["Windows 11 Pro", "Windows 10 Pro", "macOS Sonoma", "macOS Ventura", "iPadOS 17", "Android 14"];
  const DEVICE_TYPES = ["Laptop", "Desktop", "Monitor", "Printer", "Mobile Phone", "Tablet", "POS Terminal", "Router / Switch"];
  const ASSET_STATUS = ["In Service", "In Stock", "Maintenance", "Retired", "Lost / Stolen"];

  /* ---------------------- realistic ticket templates ---------------------- */
  const TICKET_TEMPLATES = [
    { c: "VPN & Remote Access", p: "High", s: "Cannot connect to store VPN from home", kb: "vpn" },
    { c: "VPN & Remote Access", p: "Medium", s: "VPN keeps disconnecting every few minutes", kb: "vpn" },
    { c: "Network & Wi-Fi", p: "High", s: "No internet on the till lane — POS offline", kb: "dns" },
    { c: "Network & Wi-Fi", p: "Medium", s: "Wi-Fi very slow in the back office", kb: "dns" },
    { c: "Printer & Scanning", p: "Medium", s: "Receipt printer jamming continuously", kb: "printer" },
    { c: "Printer & Scanning", p: "Low", s: "Cannot scan to shared folder", kb: "printer" },
    { c: "Microsoft 365", p: "High", s: "Outlook shows 'Need to Repair' and won't open", kb: "m365" },
    { c: "Microsoft 365", p: "Medium", s: "OneDrive not syncing stock reports", kb: "m365" },
    { c: "Microsoft 365", p: "Low", s: "Teams camera not detected in meetings", kb: "m365" },
    { c: "Account & Access", p: "Critical", s: "Locked out after password reset", kb: "account" },
    { c: "Account & Access", p: "High", s: "No access to shared drive for merchandising", kb: "account" },
    { c: "Email Issues", p: "High", s: "External emails bouncing with NDR 5.7.600", kb: "email" },
    { c: "Email Issues", p: "Medium", s: "Missing emails from supplier in inbox", kb: "email" },
    { c: "Laptop / Desktop", p: "High", s: "Laptop blue-screens on boot (INACCESSIBLE_BOOT_DEVICE)", kb: "windows" },
    { c: "Laptop / Desktop", p: "Medium", s: "Machine extremely slow, high disk usage 100%", kb: "windows" },
    { c: "Laptop / Desktop", p: "Low", s: "MacBook won't wake from sleep", kb: "macos" },
    { c: "Software Application", p: "High", s: "ERP module throws error on invoice entry", kb: "app" },
    { c: "Software Application", p: "Medium", s: "Antivirus blocking the stock app", kb: "app" },
    { c: "Phone & Mobility", p: "Medium", s: "Company phone not receiving MDM policy", kb: "mobility" },
    { c: "Peripherals", p: "Low", s: "Barcode scanner not reading product codes", kb: "periph" },
    { c: "Warranty & Repair", p: "Low", s: "Battery swollen — device needs repair", kb: "repair" }
  ];

  const RESOLUTION_NOTES = {
    vpn: "Re-provisioned the VPN profile and enforced MFA re-registration. Tunnel now stable; confirmed with user.",
    dns: "Reset TCP/IP stack and set internal DNS forwarders. Connectivity restored at the affected lane.",
    printer: "Cleaned the print head, cleared the spooler and reinstalled the driver via the deployment share.",
    m365: "Ran Office /online repair and reactivated the licence. Sync client reset for OneDrive.",
    account: "Unlocked the account, forced a password reset and re-applied group membership in Entra ID.",
    email: "Corrected the MX/connectors routing and released the message from the quarantine queue.",
    windows: "Booted into safe mode, rolled back the storage driver and applied pending Windows updates.",
    macos: "Reset SMC/NVRAM and updated to the latest macOS point release. Sleep now behaves correctly.",
    app: "Cleared local cache and whitelisted the application in endpoint protection. Retested end-to-end.",
    mobility: "Re-enrolled the device in MDM and pushed the missing compliance policy.",
    periph: "Re-paired the scanner and reloaded the symbology configuration profile.",
    repair: "Raised an RMA with the vendor and issued a loaner device pending warranty repair."
  };

  /* ---------------------- time helpers ---------------------- */
  const HOUR = 3600 * 1000, DAY = 24 * HOUR;
  const NOW = Date.now();
  const hoursAgo = (h) => new Date(NOW - h * HOUR).toISOString();
  const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();

  /* ---------------------- build synthetic dataset ---------------------- */
  function buildAssets() {
    const models = {
      Laptop: ["Dell Latitude 5440", "Lenovo ThinkPad T14", "HP EliteBook 840 G10", "Apple MacBook Pro 14"],
      Desktop: ["Dell OptiPlex 7010", "HP ProDesk 600 G9", "Lenovo ThinkCentre M70q"],
      Monitor: ["Dell P2422H", "LG 27UP850", "Samsung S24D"],
      Printer: ["Zebra ZD421 (receipt)", "HP LaserJet Pro M404", "Epson TM-T88X", "Canon iR C3226"],
      "Mobile Phone": ["iPhone 14", "Samsung Galaxy A54", "Google Pixel 8"],
      Tablet: ["iPad Air", "Samsung Galaxy Tab A8"],
      "POS Terminal": ["Verifone P400", "Ingenico Lane 7000"],
      "Router / Switch": ["Cisco Catalyst 9200", "Aruba AP-515", "Fortinet FG-90G"]
    };
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const type = pick(DEVICE_TYPES);
      const model = pick(models[type]);
      const isApple = /MacBook|iPad|iPhone/.test(model);
      const isNet = type === "Router / Switch" || type === "POS Terminal";
      const os = isNet ? "Firmware" : isApple ? pick(["macOS Sonoma", "iPadOS 17", "macOS Ventura"]) : pick(["Windows 11 Pro", "Windows 10 Pro", "Android 14"]);
      const status = chance(0.08) ? pick(["Maintenance", "In Stock", "Retired"]) : "In Service";
      const wStart = new Date(NOW - randInt(200, 1400) * DAY);
      const wEnd = new Date(wStart.getTime() + randInt(365, 1095) * DAY);
      arr.push({
        id: "AST-" + String(1000 + i),
        tag: "GMG-" + type.slice(0, 2).toUpperCase() + "-" + String(4820 + i),
        name: model,
        type, os,
        serial: "SN" + Math.floor(rnd() * 9e8 + 1e8),
        site: pick(SITES),
        assignedTo: status === "In Service" ? pick(REQUESTERS) : "IT Store Room",
        assignedDept: pick(DEPTS),
        status,
        // health score drives the "Health" column
        health: randInt(38, 100),
        purchase: wStart.toISOString().slice(0, 10),
        warrantyEnd: wEnd.toISOString().slice(0, 10),
        lastPatch: daysAgo(randInt(0, 40)),
        notes: ""
      });
    }
    return arr;
  }

  function buildTickets(assets) {
    const arr = [];
    const total = 78;
    for (let i = 0; i < total; i++) {
      const t = pick(TICKET_TEMPLATES);
      const priority = chance(0.12) ? pick(PRIORITIES) : t.p;
      const createdH = randInt(1, 260); // hours ago
      const created = new Date(NOW - createdH * HOUR);
      const target = SLA[priority].resolution;
      const respondedH = Math.min(createdH, randInt(0, Math.max(1, Math.round(target * 0.4))));
      const responder = pick(ANALYSTS.slice(0, 5));
      // older tickets more likely to be resolved
      const ageFactor = Math.min(1, createdH / 120);
      let status;
      if (chance(0.45 + ageFactor * 0.4)) status = chance(0.6) ? "Closed" : "Resolved";
      else if (chance(0.5)) status = "In Progress";
      else if (chance(0.35)) status = "Waiting User";
      else status = "Open";
      const done = status === "Resolved" || status === "Closed";
      const resolvedH = done ? Math.max(0.5, respondedH + randInt(1, Math.round(target * (chance(0.78) ? 0.9 : 1.7)))) : null;
      const resolvedAt = done ? new Date(created.getTime() + resolvedH * HOUR).toISOString() : null;
      const relatedAsset = chance(0.55) ? pick(assets) : null;
      const assignee = done || status !== "Open" ? responder : pick(ANALYSTS);
      const requester = pick(REQUESTERS);
      const site = relatedAsset ? relatedAsset.site : pick(SITES);

      const activity = [
        { type: "sys", author: "System", at: created.toISOString(), text: `Ticket created via ${pick(["self-service portal", "email", "phone", "walk-up", "Teams chat"])} · category: ${t.c} · priority: ${priority}.` }
      ];
      activity.push({ type: "status", author: assignee.name, at: new Date(created.getTime() + respondedH * HOUR).toISOString(), text: `Assigned to ${assignee.name} and acknowledged within SLA response target (${SLA[priority].response}h).` });
      activity.push({ type: "reply", author: assignee.name, at: new Date(created.getTime() + respondedH * HOUR + 40 * 60000).toISOString(), text: "Reached out to the user, gathered device and account details, reproduced the reported behaviour." });
      if (done) activity.push({ type: "reply", author: assignee.name, at: resolvedAt, text: RESOLUTION_NOTES[t.kb] });
      if (done) activity.push({ type: "status", author: "System", at: resolvedAt, text: `Status set to ${status}. Resolution confirmed by the requester.` });

      arr.push({
        id: "TKT-" + String(2400 + i),
        subject: t.s,
        description: `${t.s}. Reported at ${site}. User is ${pick(["unable to continue day-to-day tasks", "blocked at the point of sale", "working remotely and affected", "seeing intermittent failures", "getting an error on launch"])}. Requested urgent handling given store trading hours.`,
        category: t.c,
        priority,
        status,
        requester,
        dept: relatedAsset ? relatedAsset.assignedDept : pick(DEPTS),
        site,
        assignee: assignee.name,
        kbRef: t.kb,
        asset: relatedAsset ? relatedAsset.tag : null,
        created: created.toISOString(),
        resolvedAt,
        activity,
        tags: Array.from(new Set([t.c.split(" ")[0].toLowerCase(), site.split(" ")[0].toLowerCase()]))
      });
    }
    return arr.sort((a, b) => new Date(b.created) - new Date(a.created));
  }

  /* ---------------------- knowledge base ---------------------- */
  const KB = [
    { id: "vpn", icon: "🔐", cat: "VPN & Remote Access", title: "Fortinet / GlobalProtect VPN will not connect",
      summary: "When a remote user cannot establish a VPN tunnel to the corporate network.",
      steps: [
        { h: "Confirm fundamentals", p: "Verify internet access, correct gateway/portal address, and that the user's account is not locked in Entra ID / AD." },
        { h: "Rebuild the tunnel", p: "Disconnect, kill stuck VPN processes, then reconnect. Check for a stale session on the firewall." },
        { h: "Reset adapter and certs", p: "Disable/enable the virtual adapter, clear expired client certificates, re-register MFA device." },
        { h: "Escalate with logs", p: "If split-tunnel/DNS push fails, gather the VPN client log and route to the Network team." }
      ],
      cmds: ["ipconfig /release && ipconfig /renew", "route print | findstr 0.0.0.0"] },
    { id: "dns", icon: "🌐", cat: "Network & Wi-Fi", title: "DNS resolution / no-internet troubleshooting",
      summary: "Hosts resolve slowly or not at all; a POS lane shows offline.",
      steps: [
        { h: "Isolate the scope", p: "Single device or whole subnet? Ping the gateway, then an IP (e.g. 1.1.1.1), then a hostname." },
        { h: "Flush and re-point", p: "Flush DNS and reset the resolver stack; confirm the correct internal DNS forwarders are set via DHCP." },
        { h: "Test name resolution", p: "nslookup an internal resource and an external one to tell split-horizon from total failure." }
      ],
      cmds: ["ipconfig /flushdns", "netsh int ip reset", "nslookup corp.gmg.local"] },
    { id: "printer", icon: "🖨️", cat: "Printer & Scanning", title: "Receipt / office printer jam & offline",
      summary: "A printer is jamming, offline, or not receiving jobs.",
      steps: [
        { h: "Clear the queue", p: "Stop the spooler, clear stuck jobs, restart the service." },
        { h: "Check physical & media", p: "Remove jammed media, verify paper type/sensors, clean the print head on thermal units." },
        { h: "Reinstall driver/port", p: "Redeploy the driver from the share, re-add the IP port, print a test page." }
      ],
      cmds: ["net stop spooler && del /q %systemroot%\\System32\\spool\\PRINTERS\\* && net start spooler"] },
    { id: "m365", icon: "📧", cat: "Microsoft 365", title: "Outlook / Office repair & activation",
      summary: "Office apps prompt to repair, crash, or show a licence error.",
      steps: [
        { h: "Run Online Repair", p: "Use Office /online repair which re-signs binaries and refreshs activation." },
        { h: "Check licence & add-in", p: "Confirm the signed-in account holds the licence; boot Outlook in safe mode to rule out add-ins." },
        { h: "Rebuild profile", p: "Create a fresh Outlook mail profile if the PST/OST cache is corrupt." }
      ],
      cmds: ["outlook.exe /safe", "%programfiles%\\Common Files\\Microsoft Shared\\Office16\\WINWORD.EXE /safe"] },
    { id: "account", icon: "👤", cat: "Account & Access", title: "Account lockout & password reset",
      summary: "User is locked out or stuck in a password-change loop.",
      steps: [
        { h: "Find the lock source", p: "Check for a saved credential on a mobile device or service pinning the old password." },
        { h: "Unlock & re-apply", p: "Unlock the account, force a reset at next logon, confirm group membership applied." },
        { h: "Re-register MFA", p: "If locked after reset, re-register the authenticator to clear MFA state." }
      ],
      cmds: [] },
    { id: "email", icon: "✉️", cat: "Email Issues", title: "NDR 5.7.600 & message delivery",
      summary: "External mail bounces or supplier messages go missing.",
      steps: [
        { h: "Read the NDR", p: "Decode the enhanced status code to see if it is routing, hybrid or policy." },
        { h: "Trace the message", p: "Use Message Trace in Exchange Online to follow or drop the item." },
        { h: "Check connectors", p: "Validate send/receive connectors and mail flow rules that may block the domain." }
      ],
      cmds: [] },
    { id: "windows", icon: "🪟", cat: "Laptop / Desktop", title: "Windows BSOD & performance triage",
      summary: "Blue screens, boot failures, or 100% disk/CPU stalls.",
      steps: [
        { h: "Safe mode & rollback", p: "Boot safe mode, roll back the last driver/update, check Event Viewer for the fault bucket." },
        { h: "Health checks", p: "Run SFC/DISM and a storage health check; confirm the disk is not failing." },
        { h: "Trim startup", p: "Disable heavy startup items and pending Windows updates causing thrash." }
      ],
      cmds: ["sfc /scannow", "DISM /Online /Cleanup-Image /RestoreHealth"] },
    { id: "macos", icon: "🍎", cat: "Laptop / Desktop", title: "macOS sleep & SMC/NVRAM reset",
      summary: "A Mac won't sleep/wake reliably or peripheral power behaves oddly.",
      steps: [
        { h: "Update & reset", p: "Apply the latest point release; reset SMC and NVRAM on the relevant model." },
        { h: "Check power settings", p: "Review Energy Saver / sleep timers and Bluetooth/Wi-Fi wake causes." }
      ],
      cmds: ["pmset -g assertions"] },
    { id: "app", icon: "🧩", cat: "Software Application", title: "Line-of-business app errors & AV false blocks",
      summary: "ERP/stock application errors or antivirus quarantines a needed file.",
      steps: [
        { h: "Reproduce & log", p: "Capture the exact error and timestamp; correlate with the app/event log." },
        { h: "Whitelist safely", p: "Add a reviewed exclusion for the signed vendor path in endpoint protection." }
      ],
      cmds: [] },
    { id: "mobility", icon: "📱", cat: "Phone & Mobility", title: "MDM enrolment & policy push",
      summary: "A company phone is not compliant or missing policies.",
      steps: [
        { h: "Re-enrol", p: "Remove and re-add the device in the MDM console; confirm check-in." },
        { h: "Sync compliance", p: "Force a device sync and read the compliance reason code." }
      ],
      cmds: [] },
    { id: "periph", icon: "🔌", cat: "Peripherals", title: "Barcode scanner & dock issues",
      summary: "Scanner won't read codes or a docking station drops displays.",
      steps: [
        { h: "Reload config", p: "Re-scan the programming barcodes / reload the symbology profile." },
        { h: "Firmware & power", p: "Update dock firmware and confirm sufficient power delivery." }
      ],
      cmds: [] },
    { id: "repair", icon: "🛠️", cat: "Warranty & Repair", title: "Hardware repair, RMA & loaner",
      summary: "Physical device needs warranty service.",
      steps: [
        { h: "Assess warranty", p: "Check the asset warranty end date and fault reproducibility." },
        { h: "Raise RMA", p: "Open a vendor RMA, issue a loaner, and update the asset register." }
      ],
      cmds: [] }
  ];

  /* expose to the rest of the IIFE */
  window.__SD = { SITES, DEPTS, ANALYSTS, CATEGORIES, PRIORITIES, STATUSES, REQUESTERS, SLA, KB, buildAssets, buildTickets, OS_LIST, DEVICE_TYPES, ASSET_STATUS, NOW };
})();
