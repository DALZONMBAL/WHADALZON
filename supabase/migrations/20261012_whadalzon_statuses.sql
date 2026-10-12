-- WHADALZON: statuts temporaires (24 h), sans supprimer les données existantes.
create table if not exists public.statuses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 content text not null default '',
 image_url text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '24 hours'),
 constraint statuses_content_or_image check (length(trim(content)) > 0 or image_url is not null)
);
create index if not exists statuses_expiry_idx on public.statuses(expires_at desc);
create index if not exists statuses_user_created_idx on public.statuses(user_id,created_at desc);
alter table public.statuses enable row level security;
drop policy if exists "active statuses are visible" on public.statuses;
create policy "active statuses are visible" on public.statuses for select using (auth.uid() is not null and expires_at > now());
drop policy if exists "users create own statuses" on public.statuses;
create policy "users create own statuses" on public.statuses for insert with check (auth.uid()=user_id and expires_at <= now()+interval '24 hours' and expires_at > now());
drop policy if exists "users delete own statuses" on public.statuses;
create policy "users delete own statuses" on public.statuses for delete using (auth.uid()=user_id);
