-- Self-service (Google) sign-ups start inactive and only count as students
-- once an admin approves them. approved_at records that decision; NULL means
-- the account is still waiting in the approval queue.
alter table public.profiles add column if not exists approved_at timestamptz;

-- Every existing profile was created by the seed script or by an admin import,
-- so treat them as already approved instead of locking out current accounts.
update public.profiles
   set approved_at = coalesce(created_at, now())
 where approved_at is null;

create index if not exists profiles_approved_at_idx
  on public.profiles (approved_at);

comment on column public.profiles.approved_at is
  'When an admin approved the account. NULL marks a self-signup that is still pending.';
