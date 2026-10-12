-- WHADALZON: secure private one-to-one chat without deleting existing data.
-- Apply this migration in Supabase SQL Editor after reviewing it.
alter table public.conversations add column if not exists direct_key text;
create unique index if not exists conversations_direct_key_uidx
  on public.conversations(direct_key) where direct_key is not null;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create or replace function public.create_direct_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  conversation_key text;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if target_user is null or target_user = current_user_id then
    raise exception 'Choose another member';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user) then
    raise exception 'Member not found';
  end if;

  conversation_key := least(current_user_id::text, target_user::text)
    || ':' || greatest(current_user_id::text, target_user::text);

  insert into public.conversations(direct_key)
    values (conversation_key)
    on conflict (direct_key) where direct_key is not null do nothing;

  select c.id into new_conversation_id
    from public.conversations c
    where c.direct_key = conversation_key;

  insert into public.conversation_members(conversation_id, user_id)
    values (new_conversation_id, current_user_id), (new_conversation_id, target_user)
    on conflict (conversation_id, user_id) do nothing;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

-- Avoid recursive RLS checks and prevent clients from adding arbitrary members.
drop policy if exists "members see conversations" on public.conversations;
create policy "members see conversations" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

drop policy if exists "authenticated create conversations" on public.conversations;
create policy "conversations created through RPC" on public.conversations
  for insert to authenticated with check (false);

drop policy if exists "members see membership" on public.conversation_members;
create policy "members see membership" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "authenticated add membership" on public.conversation_members;
create policy "membership managed through RPC" on public.conversation_members
  for insert to authenticated with check (false);

drop policy if exists "members see messages" on public.messages;
create policy "members see messages" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated with check (
    auth.uid() = sender_id and public.is_conversation_member(conversation_id)
  );

-- Ensure message inserts are broadcast for live chats; no duplicate publication entry.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when undefined_object then
  null;
end $$;
