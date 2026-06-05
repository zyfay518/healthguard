alter table public.vital_records
  alter column systolic drop not null,
  alter column diastolic drop not null,
  alter column heart_rate drop not null;

update public.vital_records
set
  systolic = nullif(systolic, 0),
  diastolic = nullif(diastolic, 0),
  heart_rate = nullif(heart_rate, 0);
