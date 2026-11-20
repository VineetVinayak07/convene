/*
  Convene configuration.

  Paste your Supabase project URL and your publishable (anon) key below.
  Find them in Supabase: Project Settings > API Keys (or the "Connect" button).

  These two values are SAFE to commit to GitHub: they are designed to be public,
  and the database is protected by the Row Level Security rules in supabase/schema.sql.
  NEVER paste the "secret" or "service_role" key anywhere in this project.
*/
window.CONVENE_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-PUBLISHABLE-OR-ANON-KEY"
};
