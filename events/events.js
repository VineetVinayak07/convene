(async function () {
  "use strict";
  var C = window.Convene;
  var ctx = await C.initPage();
  if (!ctx) return;

  var PAGE_SIZE = 12;
  var offset = 0;
  var upcoming = true;
  var term = "";
  var category = "";
  var requestId = 0;

  var grid = document.getElementById("grid");
  var moreBtn = document.getElementById("more");
  var countEl = document.getElementById("result-count");
  var searchEl = document.getElementById("search");
  var catEl = document.getElementById("category");
  var tabUp = document.getElementById("tab-upcoming");
  var tabPast = document.getElementById("tab-past");

  C.CATEGORIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    catEl.appendChild(o);
  });

  async function load(reset) {
    var myRequest = ++requestId;
    if (reset) {
      offset = 0;
      grid.innerHTML = '<div class="loading" style="grid-column:1/-1">Loading events...</div>';
      moreBtn.hidden = true;
    }
    var now = new Date().toISOString();
    var q = C.db.from("events").select("*", { count: "exact" }).eq("status", "published");
    q = upcoming
      ? q.gte("ends_at", now).order("starts_at", { ascending: true })
      : q.lt("ends_at", now).order("starts_at", { ascending: false });
    if (category) q = q.eq("category", category);
    if (term) {
      var t = term.replace(/[,()%*\\_]/g, " ").trim();
      if (t) q = q.or("title.ilike.%" + t + "%,location.ilike.%" + t + "%");
    }

    var r = await q.range(offset, offset + PAGE_SIZE - 1);
    if (myRequest !== requestId) return; // a newer search replaced this one

    if (r.error) {
      C.empty(grid, "Could not load events", C.friendlyError(r.error));
      countEl.textContent = "";
      return;
    }
    if (reset) grid.innerHTML = "";

    if (!r.data.length && offset === 0) {
      grid.innerHTML = "";
      C.empty(grid, upcoming ? "No upcoming events found" : "No past events found",
        term || category ? "Try a different search or category." : "Check back soon, or host one yourself.",
        upcoming && !term && !category ? '<a class="btn" href="../create/">Host an event</a>' : "");
      grid.firstChild.style.gridColumn = "1/-1";
      countEl.textContent = "";
      moreBtn.hidden = true;
      return;
    }

    grid.insertAdjacentHTML("beforeend", r.data.map(function (ev) { return C.eventCard(ev); }).join(""));
    offset += r.data.length;
    countEl.textContent = r.count + (r.count === 1 ? " event" : " events");
    moreBtn.hidden = offset >= r.count;
  }

  function setTab(isUpcoming) {
    upcoming = isUpcoming;
    tabUp.setAttribute("aria-selected", isUpcoming ? "true" : "false");
    tabPast.setAttribute("aria-selected", isUpcoming ? "false" : "true");
    load(true);
  }

  tabUp.addEventListener("click", function () { setTab(true); });
  tabPast.addEventListener("click", function () { setTab(false); });
  catEl.addEventListener("change", function () { category = catEl.value; load(true); });
  moreBtn.addEventListener("click", function () { load(false); });

  var timer;
  searchEl.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { term = searchEl.value.trim(); load(true); }, 300);
  });

  load(true);
})();
