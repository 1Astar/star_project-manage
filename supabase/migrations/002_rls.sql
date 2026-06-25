-- RLS policies for Star PM (enable when using Supabase Auth)

alter table projects enable row level security;
alter table requirements enable row level security;
alter table role_tasks enable row level security;
alter table share_links enable row level security;
alter table notifications enable row level security;

-- Admin: authenticated users full access
create policy "admin_all_projects" on projects
  for all using (auth.role() = 'authenticated');

create policy "admin_all_requirements" on requirements
  for all using (auth.role() = 'authenticated');

create policy "admin_all_role_tasks" on role_tasks
  for all using (auth.role() = 'authenticated');

-- Share links readable by service role only (token validated in API)
create policy "service_share_links" on share_links
  for select using (auth.role() = 'service_role');

create policy "admin_notifications" on notifications
  for all using (auth.role() = 'authenticated');

-- Storage bucket for prototypes
insert into storage.buckets (id, name, public)
values ('prototypes', 'prototypes', false)
on conflict (id) do nothing;

create policy "admin_prototype_upload" on storage.objects
  for insert with check (bucket_id = 'prototypes' and auth.role() = 'authenticated');

create policy "admin_prototype_read" on storage.objects
  for select using (bucket_id = 'prototypes' and auth.role() = 'authenticated');
