-- The current project had no legacy plates. Validate the required client link.
alter table public.plates validate constraint plates_client_required;
