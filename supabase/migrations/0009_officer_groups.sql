-- Saved officer groups for gatekeeper assignment.
--
-- Council or organization officers tend to be the same handful of students for
-- every event. Instead of searching each student inside Create Event, the admin
-- keeps a named list here and adds the whole group to an event in one action.
--
-- Membership is read (not referenced) when a group is added to an event: the
-- grants are copied into event_temp_organizers, so later edits to the group do
-- not change events that were already set up. Expiry therefore stays per event.

create table if not exists public.officer_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: "SSG Officers" and "ssg officers" are one group.
create unique index if not exists officer_groups_name_idx
  on public.officer_groups (lower(name));

create table if not exists public.officer_group_members (
  group_id uuid not null references public.officer_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create index if not exists officer_group_members_profile_idx
  on public.officer_group_members (profile_id);

comment on table public.officer_groups is
  'Reusable named lists of student officers, used to add several temporary gatekeepers to an event at once.';

comment on table public.officer_group_members is
  'Membership rows for officer_groups. Grants are copied to event_temp_organizers when a group is added to an event, so this is a picklist, not a live binding.';

alter table public.officer_groups enable row level security;
alter table public.officer_group_members enable row level security;

drop policy if exists officer_groups_admin on public.officer_groups;
create policy officer_groups_admin on public.officer_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists officer_group_members_admin on public.officer_group_members;
create policy officer_group_members_admin on public.officer_group_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.officer_groups to authenticated;
grant select, insert, delete on public.officer_group_members to authenticated;
