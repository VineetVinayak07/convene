-- =====================================================================
-- OPTIONAL demo data so the site is not empty when you show it.
--
-- 1. Run schema.sql first.
-- 2. Create an account on the website (this account will "host" the demo events).
-- 3. Run this file in Supabase > SQL Editor.
-- Running it twice adds the events twice, so run it once.
-- =====================================================================
do $$
declare
  org uuid;
begin
  select id into org from public.profiles order by created_at limit 1;
  if org is null then
    raise exception 'Create an account on the website first, then run this seed.';
  end if;

  insert into public.events (organizer_id, title, description, category, location, starts_at, ends_at, capacity) values
  (org, 'Intro to Web Development Workshop',
   E'A hands-on session covering HTML, CSS and JavaScript from scratch.\n\nBring your laptop. No prior experience needed.',
   'Workshop', 'Seminar Hall A', now() + interval '3 days', now() + interval '3 days 3 hours', 40),

  (org, 'Startup Pitch Evening',
   E'Five student teams pitch to a panel of mentors. Networking and snacks afterwards.',
   'Business', 'Auditorium', now() + interval '6 days', now() + interval '6 days 2 hours', 120),

  (org, 'Open Mic Night',
   E'Music, poetry, comedy. Sign up on the day or just come to listen.',
   'Music', 'Campus Lawn', now() + interval '9 days', now() + interval '9 days 3 hours', null),

  (org, 'Inter-Department Football Tournament',
   E'Knockout format. Teams of seven. Register your team at the desk before kick-off.',
   'Sports', 'Main Ground', now() + interval '12 days', now() + interval '12 days 6 hours', 80),

  (org, 'Careers in Data: Live Q&A',
   E'Three working analysts answer your questions about getting started in data roles.',
   'Education', 'Online', now() + interval '15 days', now() + interval '15 days 1 hour 30 minutes', 200),

  (org, 'Art and Design Exhibition',
   E'Student work across painting, illustration and digital design. Entry is free.',
   'Arts', 'Gallery Hall', now() + interval '20 days', now() + interval '21 days', null);
end $$;
