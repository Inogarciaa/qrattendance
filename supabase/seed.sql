insert into public.programs (code, name) values
  ('SBIT', 'SBIT'),
  ('ARFIEN', 'ARFIEN'),
  ('SSLATE', 'SSLATE'),
  ('SHTM', 'SHTM')
on conflict (code) do nothing;
