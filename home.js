(async function () {
  "use strict";
  var C = window.Convene;
  var grid = document.getElementById("home-events");

  var ctx = await C.initPage();
  if (!ctx) { grid.innerHTML = ""; return; }

  var r = await C.db
    .from("events")
    .select("*")
    .eq("status", "published")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(6);

  if (r.error) {
    C.empty(grid, "Could not load events", C.friendlyError(r.error));
    return;
  }
  if (!r.data.length) {
    C.empty(grid, "No upcoming events yet", "Be the first to host one.",
      '<a class="btn" href="create/">Host an event</a>');
    return;
  }
  grid.innerHTML = r.data.map(function (ev) { return C.eventCard(ev); }).join("");
})();
