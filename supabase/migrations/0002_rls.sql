alter table public.programs enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_organizers enable row level security;
alter table public.event_audiences enable row level security;
alter table public.attendance enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.scan_attempts enable row level security;
alter table public.event_summaries enable row level security;

drop policy if exists programs_read on public.programs;
create policy programs_read on public.programs
  for select to authenticated using (true);

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_staff on public.profiles;
create policy profiles_staff on public.profiles
  for select to authenticated using (
    public.current_role() = 'organizer' and role = 'student'
  );

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists events_admin on public.events;
create policy events_admin on public.events
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists events_organizer on public.events;
create policy events_organizer on public.events
  for select to authenticated using (
    public.current_role() = 'organizer'
    and exists (
      select 1 from public.event_organizers eo
      where eo.event_id = events.id and eo.profile_id = auth.uid()
    )
  );

drop policy if exists events_student on public.events;
create policy events_student on public.events
  for select to authenticated using (
    public.current_role() = 'student'
    and exists (
      select 1 from public.event_audiences ea
      where ea.event_id = events.id and ea.program_id = public.current_program()
    )
  );

drop policy if exists eo_admin on public.event_organizers;
create policy eo_admin on public.event_organizers
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists eo_read on public.event_organizers;
create policy eo_read on public.event_organizers
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists ea_admin on public.event_audiences;
create policy ea_admin on public.event_audiences
  for all to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

drop policy if exists ea_student on public.event_audiences;
create policy ea_student on public.event_audiences
  for select to authenticated using (
    public.current_role() = 'student' and program_id = public.current_program()
  );

drop policy if exists att_admin on public.attendance;
create policy att_admin on public.attendance
  for select to authenticated using (public.current_role() = 'admin');

drop policy if exists att_student on public.attendance;
create policy att_student on public.attendance
  for select to authenticated using (student_id = auth.uid());

drop policy if exists att_organizer on public.attendance;
create policy att_organizer on public.attendance
  for select to authenticated using (
    public.current_role() = 'organizer'
    and exists (
      select 1 from public.event_organizers eo
      where eo.event_id = attendance.event_id and eo.profile_id = auth.uid()
    )
  );

drop policy if exists sa_admin on public.scan_attempts;
create policy sa_admin on public.scan_attempts
  for select to authenticated using (public.current_role() = 'admin');

drop policy if exists es_read on public.event_summaries;
create policy es_read on public.event_summaries
  for select to authenticated using (true);

grant select on public.programs to authenticated;
grant select on public.profiles to authenticated;
grant select on public.events to authenticated;
grant select on public.event_organizers to authenticated;
grant select on public.event_audiences to authenticated;
grant select on public.attendance to authenticated;
grant select on public.scan_attempts to authenticated;
grant select on public.event_summaries to authenticated;
