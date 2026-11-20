/*
  Convene shared helpers. Loaded on every page after config.js.
  Exposes one global: window.Convene
*/
(function () {
  "use strict";

  var cfg = window.CONVENE_CONFIG || {};
  var configured = !!(
    window.supabase &&
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("YOUR-PROJECT") === -1
  );
  var db = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  var root = document.body.getAttribute("data-root") || "./";
  var page = document.body.getAttribute("data-page") || "";

  // To add or rename categories, edit this list only.
  var CATEGORIES = ["Technology", "Business", "Workshop", "Education", "Arts", "Music", "Sports", "Social", "Other"];

  /* ---------------- Icons (inline SVG, no emojis) ---------------- */
  var ICONS = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3c2.2.6 3.5 2.4 3.5 5.2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    ticket: '<path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };

  function icon(name, size) {
    size = size || 18;
    return (
      '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") + "</svg>"
    );
  }

  /* ---------------- Small utilities ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function isHttps(url) {
    return typeof url === "string" && /^https:\/\/[^\s]+$/i.test(url);
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // ISO string -> value for <input type="datetime-local"> in the viewer's timezone
  function toLocalInput(iso) {
    var d = new Date(iso);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function fmtShort(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + ", " + fmtTime(iso);
  }
  function sameDay(a, b) {
    var x = new Date(a), y = new Date(b);
    return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  }
  function fmtRange(s, e) {
    if (sameDay(s, e)) return fmtDate(s) + ", " + fmtTime(s) + " to " + fmtTime(e);
    return fmtDate(s) + ", " + fmtTime(s) + " to " + fmtDate(e) + ", " + fmtTime(e);
  }
  // "6:00 PM to 8:00 PM", or with the end date when the event runs past midnight
  function fmtTimeRange(s, e) {
    if (sameDay(s, e)) return fmtTime(s) + " to " + fmtTime(e);
    return fmtTime(s) + " to " + fmtDate(e) + ", " + fmtTime(e);
  }
  function dateParts(iso) {
    var d = new Date(iso);
    return { month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(), day: d.getDate() };
  }
  function dateTile(iso) {
    var p = dateParts(iso);
    return '<div class="date-tile"><div class="m">' + esc(p.month) + '</div><div class="d">' + p.day + "</div></div>";
  }

  function eventState(ev) {
    var now = new Date();
    if (ev.status === "cancelled") return "cancelled";
    if (new Date(ev.ends_at) < now) return "past";
    if (new Date(ev.starts_at) <= now) return "started";
    if (ev.capacity != null && ev.registered_count >= ev.capacity) return "full";
    return "open";
  }

  function spotsText(ev) {
    if (ev.capacity == null) return ev.registered_count + " registered";
    var left = ev.capacity - ev.registered_count;
    return left <= 0 ? "Full" : left + " of " + ev.capacity + " spots left";
  }

  function stateBadge(state) {
    if (state === "cancelled") return '<span class="badge badge-danger">Cancelled</span>';
    if (state === "past") return '<span class="badge">Ended</span>';
    if (state === "started") return '<span class="badge">In progress</span>';
    if (state === "full") return '<span class="badge badge-danger">Full</span>';
    return "";
  }

  function friendlyError(err) {
    if (!err) return "Something went wrong. Please try again.";
    var m = err.message || String(err);
    if (err.code === "23505") return "You are already registered for this event.";
    if (err.code === "23514" && /events_capacity_ok/.test(m)) return "Capacity cannot be lower than the number of people already registered.";
    if (err.code === "23514") return "Some details are not valid. Please check the form.";
    if (err.code === "42501") return "You do not have permission to do that.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Network problem. Check your connection and try again.";
    return m;
  }

  function displayName(user) {
    var n = user && user.user_metadata && user.user_metadata.full_name;
    return n || (user && user.email ? user.email.split("@")[0] : "Account");
  }

  // Path to come back to after login, relative to the site root (e.g. "event/?id=...")
  function nextPath() {
    if (page === "home" || page === "login" || !page) return "";
    return page + "/" + location.search;
  }

  /* ---------------- Event card ---------------- */
  function eventCard(ev) {
    var st = eventState(ev);
    var media = isHttps(ev.image_url)
      ? '<img src="' + esc(ev.image_url) + '" alt="" loading="lazy">'
      : "<span>" + esc(ev.category) + "</span>";
    var when = fmtShort(ev.starts_at);
    var foot = stateBadge(st) || '<span class="badge">' + esc(ev.category) + "</span>";
    return (
      '<a class="event-card card" href="' + root + "event/?id=" + encodeURIComponent(ev.id) + '">' +
      '<div class="event-media">' + media + "</div>" +
      '<div class="event-body">' +
      '<div class="event-when">' + esc(when) + "</div>" +
      '<div class="event-title">' + esc(ev.title) + "</div>" +
      '<div class="event-meta">' + icon("pin", 16) + "<span>" + esc(ev.location) + "</span></div>" +
      '<div class="event-foot"><span>' + icon("users", 16) + " " + esc(spotsText(ev)) + "</span>" + foot + "</div>" +
      "</div></a>"
    );
  }

  function empty(el, title, text, actionHTML) {
    el.innerHTML =
      '<div class="empty"><h3>' + esc(title) + "</h3><p>" + esc(text || "") + "</p>" + (actionHTML || "") + "</div>";
  }

  /* ---------------- Toast and confirm dialog ---------------- */
  function toast(message, type) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    var t = document.createElement("div");
    t.className = "toast" + (type === "error" ? " error" : "");
    t.textContent = message;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, type === "error" ? 5000 : 3000);
  }

  function confirmDialog(message, okLabel, danger) {
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      d.className = "dialog";
      d.innerHTML =
        '<form method="dialog"><p>' + esc(message) + '</p><div class="dialog-actions">' +
        '<button class="btn btn-outline btn-sm" value="cancel">Cancel</button>' +
        '<button class="btn btn-sm' + (danger ? " btn-solid-danger" : "") + '" value="ok">' + esc(okLabel || "Confirm") + "</button>" +
        "</div></form>";
      document.body.appendChild(d);
      d.addEventListener("close", function () {
        var ok = d.returnValue === "ok";
        d.remove();
        resolve(ok);
      });
      d.showModal();
    });
  }

  /* ---------------- Header and footer ---------------- */
  function renderChrome(user) {
    var h = document.getElementById("site-header");
    if (h) {
      var links = [["events", "Events", "events/"], ["create", "Host an event", "create/"]];
      if (user) links.push(["dashboard", "Dashboard", "dashboard/"]);
      var nav = links.map(function (l) {
        return '<a class="nav-link' + (page === l[0] ? " active" : "") + '" href="' + root + l[2] + '">' + l[1] + "</a>";
      }).join("");
      var next = nextPath();
      var nextQ = next ? "&next=" + encodeURIComponent(next) : "";
      var auth = user
        ? '<a class="nav-user' + (page === "profile" ? " active" : "") + '" href="' + root + 'profile/" title="Your profile">' + esc(displayName(user)) + "</a>" +
          '<button class="btn btn-outline btn-sm" id="logout-btn" type="button">Log out</button>'
        : '<a class="btn btn-outline btn-sm" href="' + root + "login/?mode=login" + nextQ + '">Log in</a>' +
          '<a class="btn btn-sm" href="' + root + "login/?mode=signup" + nextQ + '">Sign up</a>';

      h.innerHTML =
        '<header class="site-header"><div class="container header-inner">' +
        '<a class="brand" href="' + root + '"><span class="brand-mark">' + icon("calendar", 16) + "</span>Convene</a>" +
        '<button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">' + icon("menu", 20) + "</button>" +
        '<nav class="site-nav" id="site-nav" aria-label="Main">' + nav + '<div class="nav-auth">' + auth + "</div></nav>" +
        "</div></header>";

      var toggle = h.querySelector(".nav-toggle");
      var navEl = h.querySelector("#site-nav");
      toggle.addEventListener("click", function () {
        var open = navEl.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      var lo = h.querySelector("#logout-btn");
      if (lo) {
        lo.addEventListener("click", function () {
          db.auth.signOut().then(function () { location.href = root; });
        });
      }
    }

    var f = document.getElementById("site-footer");
    if (f) {
      f.innerHTML =
        '<footer class="site-footer"><div class="container footer-inner">' +
        "<span>Convene. Simple event management.</span>" +
        "<span>Times are shown in your local time zone.</span></div></footer>";
    }
  }

  function showSetupNotice() {
    var main = document.querySelector("main");
    if (!main) return;
    var n = document.createElement("div");
    n.className = "container";
    n.innerHTML =
      '<div class="notice"><strong>Convene is not connected to Supabase yet.</strong> ' +
      "Open <code>js/config.js</code> and paste your project URL and publishable key, then reload. See the README for details.</div>";
    main.insertBefore(n, main.firstChild);
  }

  /*
    Every page calls this first.
    Returns { user } or null (null means: stop, the page is redirecting or not configured).
  */
  async function initPage(opts) {
    opts = opts || {};
    if (!db) {
      renderChrome(null);
      showSetupNotice();
      return null;
    }
    var res = await db.auth.getSession();
    var session = res && res.data ? res.data.session : null;
    var user = session ? session.user : null;

    if (opts.requireAuth && !user) {
      location.replace(root + "login/?mode=login&next=" + encodeURIComponent(nextPath()));
      return null;
    }
    renderChrome(user);
    return { user: user };
  }

  window.Convene = {
    db: db,
    root: root,
    page: page,
    CATEGORIES: CATEGORIES,
    icon: icon,
    esc: esc,
    qs: qs,
    isHttps: isHttps,
    toLocalInput: toLocalInput,
    fmtDate: fmtDate,
    fmtTime: fmtTime,
    fmtShort: fmtShort,
    fmtRange: fmtRange,
    fmtTimeRange: fmtTimeRange,
    dateTile: dateTile,
    eventState: eventState,
    spotsText: spotsText,
    stateBadge: stateBadge,
    friendlyError: friendlyError,
    displayName: displayName,
    eventCard: eventCard,
    empty: empty,
    toast: toast,
    confirmDialog: confirmDialog,
    initPage: initPage
  };
})();
