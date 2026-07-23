-- Allow arbitrary-depth module trees (was check level in (1, 2)).
alter table modules drop constraint if exists modules_level_check;

-- Keep level as positive depth from root (1-based).
alter table modules
  add constraint modules_level_positive check (level >= 1);
