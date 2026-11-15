-- Geofencing for self-service check-in.
--
-- The rotating QR proves the code is fresh; the fence proves the phone that
-- scanned it is actually at the venue. Gatekeeper scanning is not affected.
--
-- Every column is nullable, so events created before this migration keep
-- behaving exactly as they did: no coordinates means no fence is applied.
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
