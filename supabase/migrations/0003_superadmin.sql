-- Add the superadmin role and let superadmins do everything an admin can do.
-- Account management for admins/superadmins is performed by the API using the
-- service-role key, so no extra write policy is required here.

do $$ begin
  alter type user_role add value if not exists 'superadmin';
exception when duplicate_object then null; end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role::text in ('admin', 'superadmin') from public.profiles where id = auth.uid()),
    false
  );
$$;

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists events_admin on public.events;
create policy events_admin on public.events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists eo_admin on public.event_organizers;
create policy eo_admin on public.event_organizers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ea_admin on public.event_audiences;
create policy ea_admin on public.event_audiences
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists att_admin on public.attendance;
create policy att_admin on public.attendance
  for select to authenticated using (public.is_admin());

drop policy if exists sa_admin on public.scan_attempts;
create policy sa_admin on public.scan_attempts
  for select to authenticated using (public.is_admin());
