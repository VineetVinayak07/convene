(async function () {
  "use strict";
  var C = window.Convene;
  var el = document.getElementById("event-root");

  var ctx = await C.initPage();
  if (!ctx) { el.innerHTML = ""; return; }

  var user = ctx.user;
  var id = C.qs("id");
  var root = C.root;

  if (!id) {
    C.empty(el, "Event not found", "This link is missing an event.", '<a class="btn" href="../events/">Browse events</a>');
    return;
  }

  function calendarLink(ev) {
    function stamp(iso) { return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, ""); }
    return (
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(ev.title) +
      "&dates=" + stamp(ev.starts_at) + "/" + stamp(ev.ends_at) +
      "&location=" + encodeURIComponent(ev.location) +
      "&details=" + encodeURIComponent(location.href)
    );
  }

  var MESSAGES = {
    cancelled: "This event has been cancelled.",
    past: "This event has ended.",
    started: "This event has already started. Registration is closed.",
    full: "This event is full."
  };

  function actionsHTML(ev, reg, state) {
    var isOrganizer = user && user.id === ev.organizer_id;
    var h = "";

    if (isOrganizer) {
      h += '<div class="aside-msg">You are hosting this event.</div>';
      h += '<a class="btn btn-block" href="' + root + "manage/?id=" + encodeURIComponent(ev.id) + '">' + C.icon("users") + " Manage attendees</a>";
      h += '<a class="btn btn-outline btn-block" href="' + root + "create/?id=" + encodeURIComponent(ev.id) + '">' + C.icon("edit") + " Edit event</a>";
      return h;
    }

    if (reg) {
      h += '<div class="aside-msg">' + C.icon("check", 16) + " You are registered for this event." +
        (reg.checked_in ? " You have been checked in." : "") + "</div>";
      if (state !== "past") {
        h += '<button class="btn btn-danger btn-block" id="unregister-btn" type="button">Cancel my registration</button>';
      }
      return h;
    }

    if (state !== "open") {
      return '<div class="aside-msg">' + C.esc(MESSAGES[state]) + "</div>";
    }
    if (!user) {
      var next = "event/" + location.search;
      return '<a class="btn btn-block" href="' + root + "login/?mode=login&next=" + encodeURIComponent(next) + '">Log in to register</a>' +
        '<p class="small muted">New here? <a href="' + root + "login/?mode=signup&next=" + encodeURIComponent(next) + '">Create a free account</a>.</p>';
    }
    return '<button class="btn btn-block" id="register-btn" type="button">Register for this event</button>';
  }

  function render(ev, reg) {
    var state = C.eventState(ev);
    var organizer = ev.organizer && ev.organizer.full_name ? ev.organizer.full_name : "the organizer";
    document.title = ev.title + " | Convene";

    var cover = C.isHttps(ev.image_url)
      ? '<div class="detail-cover"><img src="' + C.esc(ev.image_url) + '" alt=""></div>'
      : "";

    el.innerHTML =
      '<div class="detail">' +
      "<article>" + cover +
      '<span class="badge badge-solid">' + C.esc(ev.category) + "</span> " + C.stateBadge(state) +
      "<h1>" + C.esc(ev.title) + "</h1>" +
      '<div class="prose">' + C.esc(ev.description) + "</div>" +
      "</article>" +
      '<aside class="aside card" aria-label="Event details">' +
      '<div class="info">' + C.icon("calendar", 20) + "<div><strong>" + C.esc(C.fmtDate(ev.starts_at)) + "</strong><span>" +
      C.esc(C.fmtTimeRange(ev.starts_at, ev.ends_at)) + "</span></div></div>" +
      '<div class="info">' + C.icon("pin", 20) + "<div><strong>" + C.esc(ev.location) + "</strong></div></div>" +
      '<div class="info">' + C.icon("users", 20) + "<div><strong>" + C.esc(C.spotsText(ev)) + "</strong><span>Hosted by " + C.esc(organizer) + "</span></div></div>" +
      "<hr>" +
      actionsHTML(ev, reg, state) +
      '<a class="btn btn-outline btn-block btn-sm" href="' + C.esc(calendarLink(ev)) + '" target="_blank" rel="noopener">' + C.icon("calendar", 16) + " Add to Google Calendar</a>" +
      '<button class="btn btn-outline btn-block btn-sm" id="copy-btn" type="button">' + C.icon("link", 16) + " Copy event link</button>" +
      "</aside></div>";

    bind(ev);
  }

  function bind(ev) {
    var copy = document.getElementById("copy-btn");
    if (copy) {
      copy.addEventListener("click", function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(location.href).then(function () { C.toast("Link copied."); });
        }
      });
    }

    var reg = document.getElementById("register-btn");
    if (reg) {
      reg.addEventListener("click", async function () {
        reg.disabled = true;
        var r = await C.db.from("registrations").insert({ event_id: ev.id, user_id: user.id });
        if (r.error) {
          C.toast(C.friendlyError(r.error), "error");
          await load(); // refresh the spots count in case it just filled up
        } else {
          C.toast("You are registered.");
          await load();
        }
      });
    }

    var unreg = document.getElementById("unregister-btn");
    if (unreg) {
      unreg.addEventListener("click", async function () {
        var ok = await C.confirmDialog("Cancel your registration for this event?", "Cancel registration", true);
        if (!ok) return;
        unreg.disabled = true;
        var r = await C.db.from("registrations").delete().eq("event_id", ev.id).eq("user_id", user.id);
        if (r.error) {
          C.toast(C.friendlyError(r.error), "error");
          unreg.disabled = false;
        } else {
          C.toast("Registration cancelled.");
          await load();
        }
      });
    }
  }

  async function load() {
    var r = await C.db.from("events").select("*, organizer:profiles(full_name)").eq("id", id).maybeSingle();
    if (r.error || !r.data) {
      C.empty(el, "Event not found", "It may have been removed, or the link is incorrect.", '<a class="btn" href="../events/">Browse events</a>');
      return;
    }
    var reg = null;
    if (user) {
      var rr = await C.db.from("registrations").select("id, checked_in").eq("event_id", id).eq("user_id", user.id).maybeSingle();
      reg = rr.data || null;
    }
    render(r.data, reg);
  }

  load();
})();
