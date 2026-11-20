# Convene

A simple event management website. Visitors browse events, logged-in users register with one click, and organizers publish events, see who registered, check people in on the day, and export the attendee list.

- **Front end:** plain HTML, CSS and JavaScript. No build step, no frameworks.
- **Back end:** [Supabase](https://supabase.com) (login, Postgres database, security rules).
- **Hosting:** [Vercel](https://vercel.com) (static site).

## Features

- Sign up and log in with email and password
- Browse upcoming and past events, search by title or location, filter by category
- Event page with date, place, live spots-left count, Add to Google Calendar, copy link
- One-click registration and cancellation; **seat limits are enforced in the database**, so an event can never be overbooked
- Host an event: create, edit, cancel or delete
- Dashboard: your registrations and your hosted events
- Attendee manager (organizer only): see names and emails, check people in, search, export CSV
- Profile page
- Mobile friendly, accessible, deep purple and white, no gradients or emojis

## Project structure

```
convene/
  index.html            Home page
  home.js
  css/style.css         All styling (colours are variables at the top)
  js/config.js          YOUR Supabase URL and key go here
  js/app.js             Shared helpers (header, footer, dates, toasts)
  assets/favicon.svg
  events/               Browse and search events
  event/                Single event page and registration
  create/               Create and edit events
  dashboard/            My registrations and my hosted events
  manage/               Attendee list for organizers
  profile/              Edit your name and bio
  login/                Log in and sign up
  supabase/schema.sql   Database setup (run once)
  supabase/seed.sql     Optional demo events
  vercel.json           Hosting settings
```

Each page has its own folder with one `index.html` and one `.js` file.

---

## Setup guide

Do these in order. Total time: about 15 minutes.

### Part 1: Create the Supabase project

1. Go to <https://supabase.com> and sign in (GitHub login works).
2. Click **New project**.
   - Name: `convene`
   - Database password: create a strong one and save it somewhere. You will not need it for this site, but you cannot see it again later.
   - Region: pick the one closest to your users (for India, **Mumbai** or **Singapore**).
   - Plan: Free.
3. Click **Create new project** and wait about two minutes until the dashboard finishes loading.

### Part 2: Create the database

1. In the left sidebar open **SQL Editor**, then click **New query**.
2. Open `supabase/schema.sql` from this project, copy **all** of it, and paste it into the editor.
3. Click **Run**. You should see **Success. No rows returned**.
4. Open **Table Editor** in the sidebar. You should see three tables: `profiles`, `events`, `registrations`.

If you get an error, make sure you pasted the whole file and that you ran it on the new project. The script is safe to run again.

### Part 3: Set up login

1. In the sidebar open **Authentication**, then **Sign In / Providers** (on older dashboards: **Providers**).
2. Make sure **Email** is enabled.
3. Decide about email confirmation:
   - **For a quick demo or college submission:** switch **Confirm email** off and save. People can then sign up and use the site immediately.
   - **For a real launch:** leave it on. New users must click a link in their inbox first. (Supabase's built-in mail sender is limited to a few emails per hour, which is fine for testing but not for a big launch.)

### Part 4: Connect the website to Supabase

1. In the Supabase dashboard open **Project Settings**, then **API Keys** (you can also click the **Connect** button at the top of the dashboard).
2. Copy two things:
   - **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
   - **Publishable key** (starts with `sb_publishable_`). If your dashboard shows the older style, copy the **anon / public** key from the **Legacy API keys** tab instead. Either works.
3. Open `js/config.js` in this project and paste them in:

   ```js
   window.CONVENE_CONFIG = {
     SUPABASE_URL: "https://abcdefghijkl.supabase.co",
     SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxxxxxx"
   };
   ```

> **Safe to commit?** Yes. The URL and publishable/anon key are meant to be public. The database is protected by the security rules in `schema.sql`.
> **Never** put the **secret** key or the **service_role** key in this project.

### Part 5: Run it on your computer (optional but recommended)

The site must be opened through a small local server, not by double-clicking the file.

- **VS Code:** install the **Live Server** extension, right-click `index.html`, choose **Open with Live Server**.
- **Or with Python:** open a terminal in the project folder and run `python -m http.server 3000`, then visit <http://localhost:3000>.
- **Or with Node:** `npx serve .`

Test it: sign up, host an event, open it, register with a second account (use a private window).

**Optional demo data:** after creating your first account, paste `supabase/seed.sql` into the SQL Editor and run it once. It adds six sample events hosted by that account.

### Part 6: Put it on GitHub

Create an empty repository on <https://github.com/new> (no README, no .gitignore), then in a terminal inside the project folder:

```bash
git init
git add .
git commit -m "Initial commit: Convene event management site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/convene.git
git push -u origin main
```

No terminal? On the empty repo page click **uploading an existing file**, drag in the **contents** of the project folder (including the sub-folders), and click **Commit changes**.

### Part 7: Deploy on Vercel

1. Go to <https://vercel.com> and sign in with GitHub.
2. Click **Add New**, then **Project**.
3. Find your `convene` repository and click **Import** (if it is missing, click **Adjust GitHub App Permissions** and allow access to it).
4. On the configuration screen:
   - **Framework Preset:** `Other`
   - **Root Directory:** leave as `./`
   - **Build Command:** leave empty
   - **Output Directory:** leave empty
   - No environment variables are needed.
5. Click **Deploy**. In about 30 seconds you get a URL like `https://convene-yourname.vercel.app`.

From now on, every `git push` to `main` redeploys the site automatically.

### Part 8: Tell Supabase your live URL

This makes confirmation emails (if you left them on) link back to your real site.

1. In Supabase open **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your Vercel URL, for example `https://convene-yourname.vercel.app`.
3. Under **Redirect URLs** add `https://convene-yourname.vercel.app/**` and `http://localhost:3000/**`.
4. Save.

Done. Open your Vercel URL and try the whole flow once more on the live site.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Purple banner says "not connected to Supabase" | `js/config.js` still has the placeholder values. Paste your URL and key, save, hard refresh. |
| "Invalid API key" | You copied the wrong value. Use the publishable or anon key, with no spaces or quotes missing. |
| Sign up works but you cannot log in | Email confirmation is on. Click the link in the email, or turn **Confirm email** off (Part 3). |
| Events do not show up | Run `schema.sql` (Part 2). In Table Editor confirm the tables exist. |
| "permission denied" or "row-level security" errors | Run all of `schema.sql` again. It resets the permissions. |
| Page is blank or styling is missing on Vercel | Make sure the repo has `index.html` at the top level (not inside an extra folder) and Root Directory is `./`. |
| Page is blank locally | Open it through Live Server or `python -m http.server`, not by double-clicking. |
| Supabase free project is "paused" | Free projects pause after about a week of no use. Open the dashboard and click **Restore**. |

## Customising

- **Colours:** edit the variables at the top of `css/style.css` (`--purple`, `--purple-dark`, `--purple-soft`, `--purple-line`).
- **Categories:** edit the `CATEGORIES` list at the top of `js/app.js`.
- **Name and logo:** search for "Convene" and edit the brand text in `js/app.js` (header) and each page title.

## How the security works (short version)

- Everyone can read events. Only the organizer can edit or delete theirs.
- You can only register yourself, and only cancel your own registration.
- Only an event's organizer can see its attendee list and emails. Emails are never readable from the public tables.
- `registered_count` cannot be changed from the browser. Database triggers update it, and they also stop registrations when an event is full, cancelled, or has started.
- All user text is escaped before it is shown, so pasted HTML or scripts are displayed as plain text.

Organizer names and bios are public by design (they appear as "Hosted by").

## Not included yet

Password reset by email, waitlists, paid tickets, image uploads (a cover image link is used instead), email reminders. All of these can be added later on the same Supabase project.
