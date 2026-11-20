(async function () {
  "use strict";
  var C = window.Convene;
  var ctx = await C.initPage({ requireAuth: true });
  if (!ctx) return;

  var user = ctx.user;
  var form = document.getElementById("profile-form");
  var msg = document.getElementById("profile-msg");
  var nameEl = document.getElementById("full-name");
  var bioEl = document.getElementById("bio");
  var saveBtn = document.getElementById("save-btn");

  function show(text, ok) {
    msg.hidden = false;
    msg.className = ok ? "form-ok" : "form-error";
    msg.textContent = text;
  }

  document.getElementById("email").value = user.email || "";

  var r = await C.db.from("profiles").select("full_name, bio").eq("id", user.id).maybeSingle();
  if (r.error) { show(C.friendlyError(r.error)); }
  if (r.data) {
    nameEl.value = r.data.full_name || "";
    bioEl.value = r.data.bio || "";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msg.hidden = true;
    var name = nameEl.value.trim();
    var bio = bioEl.value.trim();
    if (name.length < 2) { show("Enter your full name."); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    var res = await C.db.from("profiles").update({ full_name: name, bio: bio }).eq("id", user.id).select("id");
    if (res.error || !res.data || !res.data.length) {
      show(res.error ? C.friendlyError(res.error) : "Could not save your profile.");
    } else {
      // Keep the name in the login session in sync so the header updates
      await C.db.auth.updateUser({ data: { full_name: name } });
      show("Profile saved.", true);
      var navUser = document.querySelector(".nav-user");
      if (navUser) navUser.textContent = name;
    }
    saveBtn.disabled = false;
    saveBtn.textContent = "Save profile";
  });
})();
