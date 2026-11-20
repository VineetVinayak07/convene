(async function () {
  "use strict";
  var C = window.Convene;
  var ctx = await C.initPage();
  if (!ctx) return;

  // Only allow redirects to pages inside this site, e.g. "event/?id=abc" or "create/"
  function safeNext() {
    var n = C.qs("next") || "";
    return /^[a-z]+\/(\?[A-Za-z0-9=&_%.\-]*)?$/.test(n) ? n : "events/";
  }
  function go() { location.href = C.root + safeNext(); }

  if (ctx.user) { go(); return; }

  var loginForm = document.getElementById("login-form");
  var signupForm = document.getElementById("signup-form");
  var msg = document.getElementById("auth-message");
  var title = document.getElementById("auth-title");
  var sub = document.getElementById("auth-sub");
  var swLogin = document.getElementById("switch-login");
  var swSignup = document.getElementById("switch-signup");

  function show(text, ok) {
    msg.hidden = false;
    msg.className = ok ? "form-ok" : "form-error";
    msg.textContent = text;
  }
  function clear() { msg.hidden = true; msg.textContent = ""; }

  function setMode(mode) {
    var signup = mode === "signup";
    loginForm.hidden = signup;
    signupForm.hidden = !signup;
    swLogin.hidden = signup;
    swSignup.hidden = !signup;
    title.textContent = signup ? "Create your account" : "Log in";
    sub.textContent = signup ? "Free, and takes under a minute." : "Welcome back.";
    document.title = (signup ? "Sign up" : "Log in") + " | Convene";
    clear();
  }

  document.getElementById("to-signup").addEventListener("click", function () { setMode("signup"); });
  document.getElementById("to-login").addEventListener("click", function () { setMode("login"); });
  setMode(C.qs("mode") === "signup" ? "signup" : "login");

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clear();
    var email = document.getElementById("login-email").value.trim();
    var password = document.getElementById("login-password").value;
    if (!email || !password) { show("Enter your email and password."); return; }

    var btn = document.getElementById("login-submit");
    btn.disabled = true;
    btn.textContent = "Logging in...";
    var r = await C.db.auth.signInWithPassword({ email: email, password: password });
    if (r.error) {
      var m = /invalid login/i.test(r.error.message) ? "Incorrect email or password." :
        /not confirmed/i.test(r.error.message) ? "Please confirm your email first. Check your inbox for the link." :
        C.friendlyError(r.error);
      show(m);
      btn.disabled = false;
      btn.textContent = "Log in";
      return;
    }
    go();
  });

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    clear();
    var name = document.getElementById("signup-name").value.trim();
    var email = document.getElementById("signup-email").value.trim();
    var password = document.getElementById("signup-password").value;

    if (name.length < 2) { show("Enter your full name."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { show("Enter a valid email address."); return; }
    if (password.length < 8) { show("Password must be at least 8 characters."); return; }

    var btn = document.getElementById("signup-submit");
    btn.disabled = true;
    btn.textContent = "Creating account...";
    var r = await C.db.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: name } }
    });
    if (r.error) {
      show(C.friendlyError(r.error));
      btn.disabled = false;
      btn.textContent = "Create account";
      return;
    }
    if (r.data && r.data.session) { go(); return; }

    // Email confirmation is switched on in Supabase: no session until the link is clicked
    signupForm.hidden = true;
    swSignup.hidden = true;
    title.textContent = "Check your email";
    sub.textContent = "";
    show("We sent a confirmation link to " + email + ". Click it, then come back and log in.", true);
  });
})();
