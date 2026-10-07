-- WHADALZON — Supabase database
-- Core social network schema for Goma
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text not null default '',
  avatar_url text,
  cover_url text,
  bio text default '',
  city text default 'Goma',
  role text not null default 'user' check (role in ('user','moderator','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  image_url text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_content_or_image check (length(trim(content)) > 0 or image_url is not null)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id,following_id),
  check(follower_id <> following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like','comment','follow','message','system')),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 2 and 500),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  constraint report_target check (post_id is not null or comment_id is not null)
);

create index if not exists posts_user_created_idx on public.posts(user_id,created_at desc);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists comments_post_created_idx on public.comments(post_id,created_at);
create index if not exists likes_post_idx on public.likes(post_id);
create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id,created_at);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts for each row execute procedure public.set_updated_at();

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts for select using (true);
drop policy if exists "users create posts" on public.posts;
create policy "users create posts" on public.posts for insert with check (auth.uid()=user_id);
drop policy if exists "users update own posts" on public.posts;
create policy "users update own posts" on public.posts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users delete own posts" on public.posts;
create policy "users delete own posts" on public.posts for delete using (auth.uid()=user_id);

drop policy if exists "likes are public" on public.likes;
create policy "likes are public" on public.likes for select using (true);
drop policy if exists "users create likes" on public.likes;
create policy "users create likes" on public.likes for insert with check (auth.uid()=user_id);
drop policy if exists "users delete own likes" on public.likes;
create policy "users delete own likes" on public.likes for delete using (auth.uid()=user_id);

drop policy if exists "comments are public" on public.comments;
create policy "comments are public" on public.comments for select using (true);
drop policy if exists "users create comments" on public.comments;
create policy "users create comments" on public.comments for insert with check (auth.uid()=user_id);
drop policy if exists "users update own comments" on public.comments;
create policy "users update own comments" on public.comments for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users delete own comments" on public.comments;
create policy "users delete own comments" on public.comments for delete using (auth.uid()=user_id);

drop policy if exists "follows are public" on public.follows;
create policy "follows are public" on public.follows for select using (true);
drop policy if exists "users create follows" on public.follows;
create policy "users create follows" on public.follows for insert with check (auth.uid()=follower_id);
drop policy if exists "users delete own follows" on public.follows;
create policy "users delete own follows" on public.follows for delete using (auth.uid()=follower_id);

drop policy if exists "users see own notifications" on public.notifications;
create policy "users see own notifications" on public.notifications for select using (auth.uid()=user_id);
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications for update using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "members see conversations" on public.conversations;
create policy "members see conversations" on public.conversations for select using (
  exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid())
);
drop policy if exists "authenticated create conversations" on public.conversations;
create policy "authenticated create conversations" on public.conversations for insert with check (auth.uid() is not null);

drop policy if exists "members see membership" on public.conversation_members;
create policy "members see membership" on public.conversation_members for select using (user_id=auth.uid() or exists(select 1 from public.conversation_members x where x.conversation_id=conversation_id and x.user_id=auth.uid()));
drop policy if exists "authenticated add membership" on public.conversation_members;
create policy "authenticated add membership" on public.conversation_members for insert with check (auth.uid() is not null);

drop policy if exists "members see messages" on public.messages;
create policy "members see messages" on public.messages for select using (
  exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid())
);
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert with check (
  auth.uid()=sender_id and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid())
);

drop policy if exists "users create reports" on public.reports;
create policy "users create reports" on public.reports for insert with check (auth.uid()=reporter_id);
drop policy if exists "users see own reports" on public.reports;
create policy "users see own reports" on public.reports for select using (auth.uid()=reporter_id);

-- Storage bucket for social media
insert into storage.buckets (id,name,public) values ('whadalzon-media','whadalzon-media',true)
on conflict (id) do nothing;

drop policy if exists "public can view whadalzon media" on storage.objects;
create policy "public can view whadalzon media" on storage.objects for select using (bucket_id='whadalzon-media');
drop policy if exists "users upload whadalzon media" on storage.objects;
create policy "users upload whadalzon media" on storage.objects for insert with check (bucket_id='whadalzon-media' and auth.uid() is not null);
drop policy if exists "users delete own whadalzon media" on storage.objects;
create policy "users delete own whadalzon media" on storage.objects for delete using (bucket_id='whadalzon-media' and owner_id=auth.uid());
