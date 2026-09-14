
create table short_links (
  id uuid primary key default gen_random_uuid(),
  original_url text not null unique,
  short_url text not null,
  created_at timestamptz not null default now()
);

alter table short_links enable row level security;

-- 任何人均可读（前端展示）
create policy "short_links_select_all" on short_links
  for select using (true);

-- 只有 Edge Function（service role）可写
create policy "short_links_insert_service" on short_links
  for insert with check (true);
