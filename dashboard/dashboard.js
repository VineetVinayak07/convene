(async function () {
  "use strict";
  var C = window.Convene;
  var ctx = await C.initPage({ requireAuth: true });
  if (!ctx) return;

  var user = ctx.user;
  var root = C.root;
  var panelReg = document.getElementById("panel-registered");
  var panelHost = document.getElementById("panel-hosting");
  var statsEl = document.getElementById("stats");
  var tabReg = document.getElementById("tab-registered");
  var tabHost = document.getElementById("tab-hosting");

  var regs = [];
  var hosted = [];

  function eventUrl(ev) { return root + "event/?id=" + encodeURIComponent(ev.id); }

  /* ---------- Registrations ---------- */
  function regRow(r) {
    var ev = r.event;
    var st = C.eventState(ev);
    var badges = C.stateBadge(st);
    if (r.checked_in) badges += ' <span class="badge badge-ok">Checked in</span>';
    var cancel = st === "past" || st === "cancelled"
      ? ""
      : '<button class="btn btn-danger btn-sm" data-cancel="' + C.esc(r.id) + '" type="button">Cancel</button>';
    return (
      '<div class="row card">' + C.dateTile(ev.starts_at) +
      '<div class="row-main"><a class="row-title" href="' + eventUrl(ev) + '">' + C.esc(ev.title) + "</a>" +
      '<div class="row-sub">' + C.esc(C.fmtShort(ev.starts_at)) + " &middot; " + C.esc(ev.location) + "</div></div>" +
      '<div class="row-actions">' + badges +
      '<a class="btn btn-outline btn-sm" href="' + eventUrl(ev) + '">View</a>' + cancel + "</div></div>"
    );
  }

  function renderRegistered() {
    if (!regs.length) {
      C.empty(panelReg, "You have not registered for anything yet", "Find an event you like and reserve your spot.",
        '<a class="btn" href="' + root + 'events/">Browse events</a>');
      return;
    }
    var now = new Date();
    var up = regs.filter(function (r) { return new Date(r.event.ends_at) >= now; })
      .sort(function (a, b) { return new Date(a.event.starts_at) - new Date(b.event.starts_at); });
    var past = regs.filter(function (r) { return new Date(r.event.ends_at) < now; })
      .sort(function (a, b) { return new Date(b.event.starts_at) - new Date(a.event.starts_at); });

    var h = "";
    if (up.length) h += '<h2 class="list-title">Upcoming</h2><div class="list">' + up.map(regRow).join("") + "</div>";
    if (past.length) h += '<h2 class="list-title">Past</h2><div class="list">' + past.map(regRow).join("") + "</div>";
    panelReg.innerHTML = h;
  }

  /* ---------- Hosting ---------- */
  function hostRow(ev) {
    var st = C.eventState(ev);
    var id = encodeURIComponent(ev.id);
    return (
      '<div class="row card">' + C.dateTile(ev.starts_at) +
      '<div class="row-main"><a class="row-title" href="' + eventUrl(ev) + '">' + C.esc(ev.title) + "</a>" +
      '<div class="row-sub">' + C.esc(C.fmtShort(ev.starts_at)) + " &middot; " + C.esc(C.spotsText(ev)) + "</div></div>" +
      '<div class="row-actions">' + C.stateBadge(st) +
      '<a class="btn btn-sm" href="' + root + "manage/?id=" + id + '">Attendees</a>' +
      '<a class="btn btn-outline btn-sm" href="' + root + "create/?id=" + id + '">Edit</a></div></div>'
    );
  }

  function renderHosting() {
    if (!hosted.length) {
      C.empty(panelHost, "You are not hosting any events", "Create your first event in under a minute.",
        '<a class="btn" href="' + root + 'create/">Host an event</a>');
      return;
    }
    var now = new Date();
    var up = hosted.filter(function (e) { return new Date(e.ends_at) >= now; })
      .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    var past = hosted.filter(function (e) { return new Date(e.ends_at) < now; });
    var h = "";
    if (up.length) h += '<h2 class="list-title">Upcoming</h2><div class="list">' + up.map(hostRow).join("") + "</div>";
    if (past.length) h += '<h2 class="list-title">Past</h2><div class="list">' + past.map(hostRow).join("") + "</div>";
    panelHost.innerHTML = h;
  }

  function renderStats() {
    var now = new Date();
    var upcomingTickets = regs.filter(function (r) { return new Date(r.event.ends_at) >= now && r.event.status === "published"; }).length;
    var totalReg = hosted.reduce(function (n, e) { return n + e.registered_count; }, 0);
    function tile(n, l) { return '<div class="stat card"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    statsEl.innerHTML = tile(upcomingTickets, "Upcoming registrations") + tile(hosted.length, "Events hosted") + tile(totalReg, "People registered to your events");
  }

  function setTab(name) {
    var isReg = name === "registered";
    tabReg.setAttribute("aria-selected", isReg ? "true" : "false");
    tabHost.setAttribute("aria-selected", isReg ? "false" : "true");
    panelReg.hidden = !isReg;
    panelHost.hidden = isReg;
  }
  tabReg.addEventListener("click", function () { setTab("registered"); });
  tabHost.addEventListener("click", function () { setTab("hosting"); });

  panelReg.addEventListener("click", async function (e) {
    var btn = e.target.closest("[data-cancel]");
    if (!btn) return;
    var ok = await C.confirmDialog("Cancel your registration for this event?", "Cancel registration", true);
    if (!ok) return;
    btn.disabled = true;
    var r = await C.db.from("registrations").delete().eq("id", btn.getAttribute("data-cancel"));
    if (r.error) {
      C.toast(C.friendlyError(r.error), "error");
      btn.disabled = false;
      return;
    }
    regs = regs.filter(function (x) { return x.id !== btn.getAttribute("data-cancel"); });
    C.toast("Registration cancelled.");
    renderStats();
    renderRegistered();
  });

  /* ---------- Load ---------- */
  var results = await Promise.all([
    C.db.from("registrations").select("id, checked_in, created_at, event:events(*)").eq("user_id", user.id),
    C.db.from("events").select("*").eq("organizer_id", user.id).order("starts_at", { ascending: false })
  ]);

  if (results[0].error || results[1].error) {
    var msg = C.friendlyError(results[0].error || results[1].error);
    C.empty(panelReg, "Could not load your dashboard", msg);
    return;
  }
  regs = (results[0].data || []).filter(function (r) { return r.event; });
  hosted = results[1].data || [];

  renderStats();
  renderRegistered();
  renderHosting();
})();
