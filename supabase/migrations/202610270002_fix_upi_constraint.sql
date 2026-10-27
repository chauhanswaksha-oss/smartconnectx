-- PostgreSQL bounded regex repetitions cannot exceed 255. Check lengths
-- separately so valid receiving UPI IDs can be saved.
alter table public.scx_settings drop constraint scx_settings_upi_id_check;
alter table public.scx_settings add constraint scx_settings_upi_id_check check (
  upi_id = '' or (
    length(split_part(upi_id,'@',1)) between 2 and 256
    and length(split_part(upi_id,'@',2)) between 2 and 64
    and upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$'
  )
);
