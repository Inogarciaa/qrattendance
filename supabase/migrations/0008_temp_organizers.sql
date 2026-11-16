-- Temporary, event-scoped gatekeeper access.
--
-- Sometimes the person working the scanner is a student. Instead of changing
-- profiles.role (which would take away their personal QR, self check-in and
-- history), the admin grants access to one event. Every scan re-checks the
-- grant, so access ends by itself at expires_at and no cron job is needed.
--
-- organizer_requests stores the student-initiated version: a student asks to
-- help organize an event and an admin decides.

create table if not exists public.event_temp_organizers (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create index if not exists event_temp_organizers_profile_idx
  on public.event_temp_organizers (profile_id, expires_at);

comment on table public.event_temp_organizers is
  'Event-scoped gatekeeper grants for students. Separate from event_organizers so replacing the permanent organizer list never drops a grant.';

comment on column public.event_temp_organizers.expires_at is
  'Event end time plus one hour (Asia/Manila). Checked on every scan, so an expired grant stops working immediately.';

create table if not exists public.organizer_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open request per student and event; decided requests stay as history.
create unique index if not exists organizer_requests_open_idx
  on public.organizer_requests (event_id, profile_id)
  where status = 'pending';

create index if not exists organizer_requests_status_idx
  on public.organizer_requests (status, created_at);

alter table public.event_temp_organizers enable row level security;
alter table public.organizer_requests enable row level security;

drop policy if exists eto_self on public.event_temp_organizers;
create policy eto_self on public.event_temp_organizers
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

drop policy if exists eto_admin_write on public.event_temp_organizers;
create policy eto_admin_write on public.event_temp_organizers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists oreq_self on public.organizer_requests;
create policy oreq_self on public.organizer_requests
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

drop policy if exists oreq_self_insert on public.organizer_requests;
create policy oreq_self_insert on public.organizer_requests
  for insert to authenticated
  with check (profile_id = auth.uid() and public.current_role() = 'student');

drop policy if exists oreq_self_delete on public.organizer_requests;
create policy oreq_self_delete on public.organizer_requests
  for delete to authenticated
  using (profile_id = auth.uid() and status = 'pending');

drop policy if exists oreq_admin_write on public.organizer_requests;
create policy oreq_admin_write on public.organizer_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A temporary gatekeeper can read the event they were assigned to, even when
-- they are not part of its audience. Defense in depth: the app goes through the
-- API, but direct reads should not leak other events.
drop policy if exists events_temp_organizer on public.events;
create policy events_temp_organizer on public.events
  for select to authenticated using (
    exists (
      select 1 from public.event_temp_organizers eto
      where eto.event_id = events.id
        and eto.profile_id = auth.uid()
        and eto.expires_at > now()
    )
  );

drop policy if exists att_temp_organizer on public.attendance;
create policy att_temp_organizer on public.attendance
  for select to authenticated using (
    exists (
      select 1 from public.event_temp_organizers eto
      where eto.event_id = attendance.event_id
        and eto.profile_id = auth.uid()
        and eto.expires_at > now()
    )
  );

grant select on public.event_temp_organizers to authenticated;
grant select, insert, delete on public.organizer_requests to authenticated;
