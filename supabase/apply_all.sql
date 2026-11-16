-- LacoQR: full schema, RLS policies and seed programs.
-- Paste this whole file into the Supabase SQL editor and run it once.

-- ===== migrations\0001_schema.sql =====
create extension if not exists "pgcrypto";

do $$ begin
  create type user_role as enum ('admin', 'organizer', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scan_mode as enum ('gatekeeper', 'self_service', 'dual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum ('draft', 'scheduled', 'live', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'late', 'absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scan_method as enum ('gatekeeper', 'self_service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type token_subject as enum ('student', 'event');
exception when duplicate_object then null; end $$;

create table if not exists public.programs (
  id serial primary key,
  code text unique not null,
  name text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id text unique not null,
  full_name text not null,
  role user_role not null default 'student',
  program_id int references public.programs(id),
  year_level int,
  birthdate date,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  venue text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  grace_minutes int not null default 15,
  scan_mode scan_mode not null default 'gatekeeper',
  status event_status not null default 'scheduled',
  qr_window_seconds int not null default 30,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.event_organizers (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (event_id, profile_id)
);

create table if not exists public.event_audiences (
  event_id uuid not null references public.events(id) on delete cascade,
  program_id int not null references public.programs(id) on delete cascade,
  primary key (event_id, program_id)
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  subject_type token_subject not null,
  subject_id uuid not null,
  token text unique not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create index if not exists qr_tokens_token_idx on public.qr_tokens (token);
create index if not exists qr_tokens_subject_idx on public.qr_tokens (subject_type, subject_id);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status attendance_status not null,
  method scan_method,
  scanned_at timestamptz not null default now(),
  scanned_by uuid references public.profiles(id),
  token_id uuid references public.qr_tokens(id),
  unique (event_id, student_id)
);

create table if not exists public.scan_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete set null,
  scanned_by uuid references public.profiles(id) on delete set null,
  method scan_method,
  result text not null,
  reason text,
  token text,
  attempted_at timestamptz not null default now()
);

create index if not exists scan_attempts_event_idx on public.scan_attempts (event_id, attempted_at desc);

create table if not exists public.event_summaries (
  event_id uuid primary key references public.events(id) on delete cascade,
  enrolled int not null default 0,
  present int not null default 0,
  late int not null default 0,
  absent int not null default 0,
  attendance_rate numeric(5, 2) not null default 0,
  generated_at timestamptz not null default now()
);

create index if not exists profiles_program_idx on public.profiles (program_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists events_date_idx on public.events (event_date);
create index if not exists events_status_idx on public.events (status);
create index if not exists event_organizers_profile_idx on public.event_organizers (profile_id);
create index if not exists event_audiences_program_idx on public.event_audiences (program_id);
create index if not exists attendance_event_idx on public.attendance (event_id);
create index if not exists attendance_student_idx on public.attendance (student_id);
create index if not exists attendance_event_status_idx on public.attendance (event_id, status);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.current_program()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select program_id from public.profiles where id = auth.uid();
$$;

do $$ begin
  alter publication supabase_realtime add table public.attendance;
exception when others then null; end $$;


-- ===== migrations\0002_rls.sql =====
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


-- ===== migrations\0003_superadmin.sql =====
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


-- ===== migrations\0004_profiles_email.sql =====
-- Store the account email on the profile so the dashboard can search students
-- by email without paging through auth.users.
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_key
  on public.profiles (lower(email))
  where email is not null;

comment on column public.profiles.email is
  'Login email for staff, or the synthetic school-id email for students/organizers.';


-- ===== migrations\0005_signup_approval.sql =====
-- Self-service (Google) sign-ups start inactive and only count as students
-- once an admin approves them. approved_at records that decision; NULL means
-- the account is still waiting in the approval queue.
alter table public.profiles add column if not exists approved_at timestamptz;

update public.profiles
   set approved_at = coalesce(created_at, now())
 where approved_at is null;

create index if not exists profiles_approved_at_idx
  on public.profiles (approved_at);

comment on column public.profiles.approved_at is
  'When an admin approved the account. NULL marks a self-signup that is still pending.';


-- ===== migrations\0006_geofence.sql =====
-- Geofencing for self-service check-in. Every column is nullable, so events
-- created before this migration keep behaving exactly as they did.
alter table public.events
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geofence_radius_m int not null default 100;

alter table public.attendance
  add column if not exists distance_m numeric,
  add column if not exists accuracy_m numeric,
  add column if not exists location_verified boolean,
  add column if not exists location_mocked boolean;

comment on column public.events.geofence_radius_m is
  'Radius in metres around latitude/longitude that counts as "at the venue".';

comment on column public.attendance.location_verified is
  'true = inside the fence, false = allowed but the fix could not be trusted, NULL = no fence applied.';

comment on column public.attendance.location_mocked is
  'true when the device reported a mocked/simulated location, so the fence result is not evidence.';


-- ===== migrations\0007_avatars.sql =====
-- Optional profile photos.
--
-- The bucket is public so a plain URL works everywhere (mobile <Image>, the web
-- dashboard). Writes go through the API with the service role, so no insert or
-- update policy is needed - only read access for the rendered avatar.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

comment on column public.profiles.photo_url is
  'Public URL of the optional profile photo, stored in the avatars bucket. NULL keeps the initials avatar.';


-- ===== migrations\0008_temp_organizers.sql =====
-- Temporary, event-scoped gatekeeper access.
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


-- ===== seed.sql =====
insert into public.programs (code, name) values
  ('SBIT', 'SBIT'),
  ('ARFIEN', 'ARFIEN'),
  ('SSLATE', 'SSLATE'),
  ('SHTM', 'SHTM')
on conflict (code) do nothing;


