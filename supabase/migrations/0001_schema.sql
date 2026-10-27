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
