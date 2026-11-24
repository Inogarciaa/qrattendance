-- migration 0011_archive_and_roles.sql
-- Add archive columns, audit log, and soft-delete/RBAC support.

-- 1. Soft-delete columns
alter table public.events add column if not exists deleted_at timestamptz;
alter table public.events add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.officer_groups add column if not exists deleted_at timestamptz;
alter table public.officer_groups add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

-- 2. Audit log
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid not null,
  meta jsonb,
  created_at timestamptz default now()
);

-- 3. RBAC Helpers
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() 
      and role = 'superadmin' 
      and deleted_at is null
  );
$$;

-- Refresh current is_admin to exclude deleted profiles
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select coalesce(
    (select role::text in ('admin', 'superadmin') from public.profiles where id = auth.uid() and deleted_at is null),
    false
  );
$$;

-- 4. Profile visibility
-- Permissive policies are OR'd. A rule of "deleted_at is null" would let every
-- signed-in user read every profile, including birthdates, which are the
-- imported-account passwords. Drop that policy if an earlier edit created it.
-- The replacement rules live in 0012_close_access_holes.sql.
alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;

-- Notify pgrst to refresh cache
notify pgrst, 'reload schema';
