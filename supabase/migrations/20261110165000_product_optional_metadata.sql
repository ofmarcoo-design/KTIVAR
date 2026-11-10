-- Optional product metadata; existing products and category assignments stay unchanged.
-- Product type, classification, prices and sale snapshots are unaffected.
alter table public.products
  add column if not exists "otherLabel" text,
  add column if not exists description text;

alter table public.products
  add constraint products_other_label_length_chk
  check ("otherLabel" is null or length("otherLabel") between 1 and 160),
  add constraint products_description_length_chk
  check (description is null or length(description) between 1 and 2000);

comment on column public.products."otherLabel" is
  'Optional custom label when categoryId points to the existing Outro(s) category. Does not create categories.';
comment on column public.products.description is
  'Optional freeform product/service description, independent of sale item snapshots.';
