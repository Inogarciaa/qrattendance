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
