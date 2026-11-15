-- Store the account email on the profile so the dashboard can search students
-- by email without paging through auth.users.
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_key
  on public.profiles (lower(email))
  where email is not null;

comment on column public.profiles.email is
  'Login email for staff, or the synthetic school-id email for students/organizers.';
