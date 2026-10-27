insert into public.programs (code, name) values
  ('BSIT', 'BS Information Technology'),
  ('BSBA', 'BS Business Administration'),
  ('BSED', 'BS Education')
on conflict (code) do nothing;
