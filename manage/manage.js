(async function () {
  "use strict";
  var C = window.Convene;
  var el = document.getElementById("manage-root");

  var ctx = await C.initPage({ requireAuth: true });
  if (!ctx) { el.innerHTML = ""; return; }

  var user = ctx.user;
  var id = C.qs("id");
  var ev = null;
  var attendees = [];
  var filter = "";

  if (!id) {
    C.empty(el, "No event selected", "", '<a class="btn" href="../dashboard/">Back to dashboard</a>');
    return;
  }

  var r = await C.db.from("events").select("*").eq("id", id).maybeSingle();
  if (r.error || !r.data) {
    C.empty(el, "Event not found", "It may have been deleted.", '<a class="btn" href="../dashboard/">Back to dashboard</a>');
    return;
  }
  if (r.data.organizer_id !== user.id) {
    C.empty(el, "Not allowed", "Only the organizer can see the attendee list.", '<a class="btn" href="../events/">Browse events</a>');
    return;
  }
  ev = r.data;
  document.title = "Attendees: " + ev.title + " | Convene";

  var a = await C.db.rpc("get_event_attendees", { p_event_id: id });
  if (a.error) {
    C.empty(el, "Could not load attendees", C.friendlyError(a.error));
    return;
  }
  attendees = a.data || [];

  // Spreadsheet programs run text starting with = + - @ as a formula, so neutralise it.
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCSV() {
    var lines = [["Name", "Email", "Registered at", "Checked in"].map(csvCell).join(",")];
    attendees.forEach(function (p) {
      lines.push([p.full_name, p.email, new Date(p.registered_at).toLocaleString(), p.checked_in ? "Yes" : "No"].map(csvCell).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = ev.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + "-attendees.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function rowsHTML() {
    var f = filter.toLowerCase();
    var list = attendees.filter(function (p) {
      return !f || (p.full_name || "").toLowerCase().indexOf(f) !== -1 || (p.email || "").toLowerCase().indexOf(f) !== -1;
    });
    if (!list.length) {
      return '<tr><td colspan="4" class="muted" style="text-align:center;padding:28px">' +
        (attendees.length ? "No one matches your search." : "No one has registered yet.") + "</td></tr>";
    }
    return list.map(function (p) {
      return (
        "<tr><td><strong>" + C.esc(p.full_name || "Unnamed") + "</strong><br><span class=\"muted small\">" + C.esc(p.email) + "</span></td>" +
        "<td>" + C.esc(new Date(p.registered_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })) + "</td>" +
        "<td>" + (p.checked_in ? '<span class="badge badge-ok">Checked in</span>' : '<span class="badge">Not yet</span>') + "</td>" +
        '<td style="text-align:right"><button class="btn btn-sm ' + (p.checked_in ? "btn-outline" : "") + '" data-toggle="' + C.esc(p.registration_id) + '" type="button">' +
        (p.checked_in ? "Undo" : "Check in") + "</button></td></tr>"
      );
    }).join("");
  }

  function statsHTML() {
    var checked = attendees.filter(function (p) { return p.checked_in; }).length;
    function tile(n, l) { return '<div class="stat card"><div class="n">' + n + '</div><div class="l">' + l + "</div></div>"; }
    var spots = ev.capacity == null ? "Unlimited" : Math.max(ev.capacity - attendees.length, 0);
    return tile(attendees.length + (ev.capacity != null ? " / " + ev.capacity : ""), "Registered") + tile(checked, "Checked in") + tile(spots, "Spots left");
  }

  function render() {
    el.innerHTML =
      '<div class="page-head" style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap">' +
      "<div><h1>" + C.esc(ev.title) + "</h1><p>" + C.esc(C.fmtShort(ev.starts_at)) + " &middot; " + C.esc(ev.location) + "</p></div>" +
      '<div class="row-actions"><a class="btn btn-outline" href="../event/?id=' + encodeURIComponent(ev.id) + '">View page</a>' +
      '<a class="btn btn-outline" href="../create/?id=' + encodeURIComponent(ev.id) + '">Edit event</a></div></div>' +
      '<div class="stats" id="m-stats">' + statsHTML() + "</div>" +
      '<div class="toolbar"><div class="search">' + C.icon("search") +
      '<input type="search" id="m-search" placeholder="Search name or email" aria-label="Search attendees" value="' + C.esc(filter) + '"></div>' +
      '<button class="btn btn-outline" id="m-export" type="button">' + C.icon("download", 16) + " Export CSV</button></div>" +
      '<div class="table-wrap"><table><thead><tr><th>Attendee</th><th>Registered</th><th>Status</th><th></th></tr></thead>' +
      '<tbody id="m-body">' + rowsHTML() + "</tbody></table></div>";

    document.getElementById("m-export").addEventListener("click", exportCSV);
    document.getElementById("m-search").addEventListener("input", function (e) {
      filter = e.target.value.trim();
      document.getElementById("m-body").innerHTML = rowsHTML();
    });
    document.getElementById("m-body").addEventListener("click", onToggle);
  }

  async function onToggle(e) {
    var btn = e.target.closest("[data-toggle]");
    if (!btn) return;
    var regId = btn.getAttribute("data-toggle");
    var p = attendees.find(function (x) { return x.registration_id === regId; });
    if (!p) return;
    var next = !p.checked_in;
    btn.disabled = true;
    var res = await C.db.from("registrations")
      .update({ checked_in: next, checked_in_at: next ? new Date().toISOString() : null })
      .eq("id", regId)
      .select("id");
    if (res.error || !res.data || !res.data.length) {
      C.toast(res.error ? C.friendlyError(res.error) : "Could not update check-in.", "error");
      btn.disabled = false;
      return;
    }
    p.checked_in = next;
    document.getElementById("m-body").innerHTML = rowsHTML();
    document.getElementById("m-stats").innerHTML = statsHTML();
  }

  render();
})();
