(async function () {
  "use strict";
  var C = window.Convene;
  var ctx = await C.initPage({ requireAuth: true });
  if (!ctx) return;

  var user = ctx.user;
  var id = C.qs("id");
  var existing = null;

  var form = document.getElementById("event-form");
  var stateMsg = document.getElementById("state-msg");
  var errBox = document.getElementById("form-error");
  var saveBtn = document.getElementById("save-btn");
  var delBtn = document.getElementById("delete-btn");

  var f = {
    title: document.getElementById("title"),
    category: document.getElementById("category"),
    capacity: document.getElementById("capacity"),
    description: document.getElementById("description"),
    location: document.getElementById("location"),
    starts: document.getElementById("starts"),
    ends: document.getElementById("ends"),
    image: document.getElementById("image"),
    status: document.getElementById("status")
  };

  C.CATEGORIES.forEach(function (c) {
    var o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    f.category.appendChild(o);
  });

  function showError(text) {
    errBox.hidden = false;
    errBox.textContent = text;
    errBox.scrollIntoView({ block: "nearest" });
  }

  // ---- Edit mode: load the event and make sure it belongs to this user ----
  if (id) {
    var r = await C.db.from("events").select("*").eq("id", id).maybeSingle();
    if (r.error || !r.data) {
      C.empty(stateMsg, "Event not found", "It may have been deleted.", '<a class="btn" href="../dashboard/">Back to dashboard</a>');
      return;
    }
    if (r.data.organizer_id !== user.id) {
      C.empty(stateMsg, "You cannot edit this event", "Only the person who created it can change it.", '<a class="btn" href="../events/">Browse events</a>');
      return;
    }
    existing = r.data;
    document.getElementById("page-title").textContent = "Edit event";
    document.getElementById("page-sub").textContent = "Changes are visible to everyone straight away.";
    document.title = "Edit event | Convene";
    saveBtn.textContent = "Save changes";
    document.getElementById("status-field").hidden = false;
    delBtn.hidden = false;

    f.title.value = existing.title;
    f.category.value = existing.category;
    f.capacity.value = existing.capacity == null ? "" : existing.capacity;
    f.description.value = existing.description;
    f.location.value = existing.location;
    f.starts.value = C.toLocalInput(existing.starts_at);
    f.ends.value = C.toLocalInput(existing.ends_at);
    f.image.value = existing.image_url || "";
    f.status.value = existing.status;
  } else {
    // Sensible defaults: next full hour, lasting two hours
    var d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 25);
    f.starts.value = C.toLocalInput(d.toISOString());
    d.setHours(d.getHours() + 2);
    f.ends.value = C.toLocalInput(d.toISOString());
  }
  form.hidden = false;

  // ---- Save ----
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errBox.hidden = true;

    var title = f.title.value.trim();
    var description = f.description.value.trim();
    var place = f.location.value.trim();
    var starts = new Date(f.starts.value);
    var ends = new Date(f.ends.value);
    var capRaw = f.capacity.value.trim();
    var image = f.image.value.trim();

    if (title.length < 3) return showError("Title must be at least 3 characters.");
    if (!description) return showError("Add a short description.");
    if (place.length < 2) return showError("Add a location.");
    if (isNaN(starts) || isNaN(ends)) return showError("Choose a start and end time.");
    if (ends <= starts) return showError("The end time must be after the start time.");
    if (!existing && starts <= new Date()) return showError("The start time must be in the future.");

    var capacity = null;
    if (capRaw !== "") {
      capacity = Number(capRaw);
      if (!Number.isInteger(capacity) || capacity < 1) return showError("Capacity must be a whole number of 1 or more.");
      if (existing && capacity < existing.registered_count) {
        return showError("Capacity cannot be lower than the " + existing.registered_count + " people already registered.");
      }
    }
    if (image && !C.isHttps(image)) return showError("The cover image link must start with https://");

    var payload = {
      title: title,
      description: description,
      category: f.category.value,
      location: place,
      image_url: image || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      capacity: capacity
    };

    saveBtn.disabled = true;
    var original = saveBtn.textContent;
    saveBtn.textContent = "Saving...";

    var res;
    if (existing) {
      payload.status = f.status.value;
      res = await C.db.from("events").update(payload).eq("id", existing.id).select("id").maybeSingle();
    } else {
      payload.organizer_id = user.id;
      res = await C.db.from("events").insert(payload).select("id").single();
    }

    if (res.error || !res.data) {
      showError(res.error ? C.friendlyError(res.error) : "Could not save. You may not have permission to edit this event.");
      saveBtn.disabled = false;
      saveBtn.textContent = original;
      return;
    }
    location.href = "../event/?id=" + encodeURIComponent(res.data.id);
  });

  // ---- Delete ----
  delBtn.addEventListener("click", async function () {
    var ok = await C.confirmDialog(
      "Delete this event? All registrations for it will be removed too. This cannot be undone. " +
      "(To keep the page but close it, set the status to Cancelled instead.)",
      "Delete event", true
    );
    if (!ok) return;
    delBtn.disabled = true;
    var r = await C.db.from("events").delete().eq("id", existing.id);
    if (r.error) {
      showError(C.friendlyError(r.error));
      delBtn.disabled = false;
      return;
    }
    location.href = "../dashboard/";
  });
})();
