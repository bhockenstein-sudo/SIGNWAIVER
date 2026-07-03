-- ============================================================
--  True Wild Coastal  ·  waiver storage
--  Run this once in Supabase:  SQL Editor  >  New query  >  Run
-- ============================================================

create table if not exists public.waivers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  full_name    text not null,
  dob          text,
  phone        text,
  email        text,
  address      text,
  emg_name     text,
  emg_rel      text,
  emg_phone    text,
  media        text,                        -- 'yes' (may use image) or 'no'
  minors       jsonb default '[]'::jsonb,   -- array of minor names
  referral     text,                        -- how they heard about you
  newsletter   boolean default false,       -- monthly newsletter opt-in
  printed_name text,
  signed_date  text,
  signature    text,                        -- base64 png data url
  pdf          text                         -- base64 pdf data url
);

-- Row Level Security: locked down by default, opened only where needed
alter table public.waivers enable row level security;

-- Guests (anonymous visitors) may submit a waiver, but cannot read any.
create policy "anyone can submit a waiver"
  on public.waivers for insert
  to anon, authenticated
  with check (true);

-- Signed-in staff can read every waiver.
create policy "staff can read waivers"
  on public.waivers for select
  to authenticated
  using (true);

-- Signed-in staff can delete a waiver.
create policy "staff can delete waivers"
  on public.waivers for delete
  to authenticated
  using (true);

-- Fast newest-first listing for the dashboard
create index if not exists waivers_created_at_idx
  on public.waivers (created_at desc);
