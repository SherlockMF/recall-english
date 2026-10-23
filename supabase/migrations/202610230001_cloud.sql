begin;

create table public.app_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  daily_deepseek_limit integer not null default 100 check (daily_deepseek_limit >= 0),
  daily_voice_session_limit integer not null default 30 check (daily_voice_session_limit >= 0),
  daily_voice_message_limit integer not null default 100 check (daily_voice_message_limit >= 0)
);

create function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_memberships where user_id = auth.uid() and active)
$$;
revoke all on function public.is_active_member() from public;
grant execute on function public.is_active_member() to authenticated, service_role;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  timezone text not null default 'Asia/Tokyo' check (length(timezone) <= 100)
);

create table public.words (
  id text primary key check (length(id) between 1 and 500),
  data jsonb not null check (jsonb_typeof(data) = 'object' and data ? 'id'
    and jsonb_typeof(data -> 'id') = 'string' and data ->> 'id' = id)
);

create table public.cloud_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);

-- Keep each collection in a real table, with one durable tombstone per deleted id.
do $$
declare table_name text;
begin
  foreach table_name in array array['user_words', 'vocabulary_lists', 'word_list_items',
    'learning_tracks', 'review_attempts', 'study_time_entries', 'user_settings'] loop
    execute format('create table public.%I (
      user_id uuid not null references auth.users(id) on delete cascade,
      id text not null check (length(id) between 1 and 500),
      data jsonb,
      revision bigint not null check (revision > 0),
      deleted boolean not null default false,
      primary key (user_id, id),
      check ((deleted and data is null) or
        (not deleted and data is not null and jsonb_typeof(data) = ''object'' and data ? ''id''
          and jsonb_typeof(data -> ''id'') = ''string'' and data ->> ''id'' = id))
    )', table_name);
    execute format('create index on public.%I(user_id, revision)', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy member_read on public.%I for select to authenticated
      using (user_id = (select auth.uid()) and (select public.is_active_member()))', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;

alter table public.word_list_items
  add column word_id text generated always as (data ->> 'wordId') stored,
  add column list_id text generated always as (data ->> 'listId') stored,
  add column shared_word_id text,
  add column private_word_id text,
  add check (deleted or (word_id is not null and list_id is not null)),
  add check ((deleted and shared_word_id is null and private_word_id is null) or
    (not deleted and coalesce((shared_word_id = word_id and private_word_id is null) or
      (private_word_id = word_id and shared_word_id is null), false))),
  add foreign key (shared_word_id) references public.words(id) deferrable initially deferred,
  add foreign key (user_id, private_word_id) references public.user_words(user_id, id) deferrable initially deferred,
  add foreign key (user_id, list_id) references public.vocabulary_lists(user_id, id) deferrable initially deferred;
create index on public.word_list_items(user_id, word_id);
create index on public.word_list_items(user_id, list_id);
create index on public.word_list_items(user_id, private_word_id) where private_word_id is not null;

alter table public.learning_tracks
  add column word_id text generated always as (data ->> 'itemId') stored,
  add column due text generated always as (data ->> 'due') stored,
  add column shared_word_id text,
  add column private_word_id text,
  add check (deleted or word_id is not null),
  add check ((deleted and shared_word_id is null and private_word_id is null) or
    (not deleted and coalesce((shared_word_id = word_id and private_word_id is null) or
      (private_word_id = word_id and shared_word_id is null), false))),
  add unique (user_id, id, word_id),
  add foreign key (shared_word_id) references public.words(id) deferrable initially deferred,
  add foreign key (user_id, private_word_id) references public.user_words(user_id, id) deferrable initially deferred;
create index on public.learning_tracks(user_id, due) where not deleted;
create index on public.learning_tracks(user_id, word_id);
create index on public.learning_tracks(user_id, private_word_id) where private_word_id is not null;

alter table public.review_attempts
  add column word_id text generated always as (data ->> 'itemId') stored,
  add column track_id text generated always as (data ->> 'trackId') stored,
  add column reviewed_at text generated always as (data ->> 'reviewedAt') stored,
  add check (deleted or (word_id is not null and track_id is not null)),
  add foreign key (user_id, track_id, word_id) references public.learning_tracks(user_id, id, word_id)
    deferrable initially deferred;
create index on public.review_attempts(user_id, reviewed_at) where not deleted;
create index on public.review_attempts(user_id, track_id, word_id);

alter table public.study_time_entries
  add column session_id text generated always as (data ->> 'sessionId') stored,
  add column local_date text generated always as (data ->> 'localDate') stored;
create index on public.study_time_entries(user_id, local_date) where not deleted;

-- Physical FK rows survive as tombstones. Deferred checks additionally require
-- live parents for live children, while allowing a whole graph to be deleted together.
create function public.check_cloud_relations() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_deleted boolean;
  private_word text;
  parent_list text;
  referenced_word text;
begin
  if tg_table_name = 'user_words' then
    select deleted into is_deleted from public.user_words where user_id = new.user_id and id = new.id;
    if is_deleted and (
      exists (select 1 from public.word_list_items where user_id = new.user_id and word_id = new.id and not deleted)
      or exists (select 1 from public.learning_tracks where user_id = new.user_id and word_id = new.id and not deleted)) then
      raise exception 'Word still has live references' using errcode = '23503';
    end if;
  elsif tg_table_name = 'vocabulary_lists' then
    select deleted into is_deleted from public.vocabulary_lists where user_id = new.user_id and id = new.id;
    if is_deleted and exists (select 1 from public.word_list_items where user_id = new.user_id and list_id = new.id and not deleted) then
      raise exception 'List still has live references' using errcode = '23503';
    end if;
  elsif tg_table_name = 'word_list_items' then
    select deleted, private_word_id, list_id, word_id into is_deleted, private_word, parent_list, referenced_word
      from public.word_list_items where user_id = new.user_id and id = new.id;
    if not is_deleted and (not exists (select 1 from public.vocabulary_lists where user_id = new.user_id and id = parent_list and not deleted)
      or (private_word is not null and not exists (select 1 from public.user_words where user_id = new.user_id and id = private_word and not deleted))
      or exists (select 1 from public.user_words where user_id = new.user_id and id = referenced_word and deleted)) then
      raise exception 'Membership requires live parents' using errcode = '23503';
    end if;
  elsif tg_table_name = 'learning_tracks' then
    select deleted, private_word_id, word_id into is_deleted, private_word, referenced_word
      from public.learning_tracks where user_id = new.user_id and id = new.id;
    if not is_deleted and ((private_word is not null and not exists
      (select 1 from public.user_words where user_id = new.user_id and id = private_word and not deleted))
      or exists (select 1 from public.user_words where user_id = new.user_id and id = referenced_word and deleted)) then
      raise exception 'Track requires a live word' using errcode = '23503';
    end if;
  end if;
  return null;
end $$;
revoke all on function public.check_cloud_relations() from public, anon, authenticated;
do $$
declare table_name text;
begin
  foreach table_name in array array['user_words', 'vocabulary_lists', 'word_list_items', 'learning_tracks'] loop
    execute format('create constraint trigger live_cloud_parents after insert or update on public.%I
      deferrable initially deferred for each row execute function public.check_cloud_relations()', table_name);
  end loop;
end $$;

create table public.usage_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('deepseek', 'voice_session', 'voice_message')),
  usage_date date not null default (current_timestamp at time zone 'UTC')::date,
  allowed boolean not null,
  remaining integer not null check (remaining >= 0),
  primary key (user_id, request_id)
);
create index on public.usage_events(user_id, usage_date, kind) where allowed;

alter table public.app_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.words enable row level security;
alter table public.cloud_revisions enable row level security;
alter table public.usage_events enable row level security;

create policy own_active_membership on public.app_memberships for select to authenticated
  using (user_id = (select auth.uid()) and active);
create policy own_profile on public.profiles for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_member()))
  with check (user_id = (select auth.uid()) and (select public.is_active_member()));
create policy shared_words on public.words for select to authenticated
  using ((select public.is_active_member()));
create policy own_usage on public.usage_events for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_member()));

revoke all on public.app_memberships, public.profiles, public.words, public.cloud_revisions,
  public.usage_events from public, anon, authenticated;
grant select on public.app_memberships, public.words, public.usage_events to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.app_memberships, public.profiles, public.words, public.cloud_revisions,
  public.usage_events to service_role;

create function public.cloud_pull(p_after_revision bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid := auth.uid();
  current_revision bigint;
  changes jsonb;
begin
  if member_id is null or not public.is_active_member() then
    raise exception 'Active membership required' using errcode = '42501';
  end if;
  if p_after_revision is null or p_after_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  -- A shared lock keeps the high-water revision and collection rows consistent.
  insert into public.cloud_revisions(user_id) values (member_id) on conflict do nothing;
  select revision into current_revision from public.cloud_revisions where user_id = member_id for share;
  if p_after_revision > current_revision then
    raise exception 'Client revision is ahead of server' using errcode = '40001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('collection', collection, 'id', id,
    'data', data, 'revision', revision) order by revision, collection, id), '[]'::jsonb)
  into changes from (
    select 'words' as collection, id, data, revision from public.user_words where user_id = member_id and revision > p_after_revision
    union all select 'lists', id, data, revision from public.vocabulary_lists where user_id = member_id and revision > p_after_revision
    union all select 'memberships', id, data, revision from public.word_list_items where user_id = member_id and revision > p_after_revision
    union all select 'tracks', id, data, revision from public.learning_tracks where user_id = member_id and revision > p_after_revision
    union all select 'attempts', id, data, revision from public.review_attempts where user_id = member_id and revision > p_after_revision
    union all select 'timeEntries', id, data, revision from public.study_time_entries where user_id = member_id and revision > p_after_revision
    union all select 'settings', id, data, revision from public.user_settings where user_id = member_id and revision > p_after_revision
  ) records;
  return jsonb_build_object('revision', current_revision, 'changes', changes);
end $$;

create function public.cloud_apply(p_expected_revision bigint, p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid := auth.uid();
  current_revision bigint;
  change jsonb;
  collection_name text;
  table_name text;
  record_id text;
  payload jsonb;
  referenced_word text;
  shared_word text;
  private_word text;
  reference_key text;
begin
  if member_id is null or not public.is_active_member() then
    raise exception 'Active membership required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Invalid sync batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) > 200 then
    raise exception 'Sync batch exceeds 200 changes' using errcode = '22023';
  end if;
  insert into public.cloud_revisions(user_id) values (member_id) on conflict do nothing;
  select revision into current_revision from public.cloud_revisions where user_id = member_id for update;
  if current_revision <> p_expected_revision then
    raise exception 'Cloud revision conflict' using errcode = '40001';
  end if;
  if jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('revision', current_revision);
  end if;
  current_revision := current_revision + 1;
  -- Parent order also makes the usual client batches easy to inspect. FKs remain deferred.
  for change in select value from jsonb_array_elements(p_changes) order by case value ->> 'collection'
    when 'words' then 0 when 'lists' then 0 when 'memberships' then 1 when 'tracks' then 1 else 2 end loop
    collection_name := change ->> 'collection';
    table_name := case collection_name when 'words' then 'user_words' when 'lists' then 'vocabulary_lists'
      when 'memberships' then 'word_list_items' when 'tracks' then 'learning_tracks'
      when 'attempts' then 'review_attempts' when 'timeEntries' then 'study_time_entries'
      when 'settings' then 'user_settings' end;
    record_id := change ->> 'id';
    payload := nullif(change -> 'data', 'null'::jsonb);
    if jsonb_typeof(change) <> 'object' or table_name is null or record_id is null or length(record_id) not between 1 and 500
      or jsonb_typeof(change -> 'id') <> 'string' or not (change ? 'data')
      or (payload is not null and (jsonb_typeof(payload) <> 'object' or
        jsonb_typeof(payload -> 'id') is distinct from 'string' or (payload ->> 'id') is distinct from record_id)) then
      raise exception 'Invalid sync change' using errcode = '22023';
    end if;
    if payload is not null then
      foreach reference_key in array case collection_name
        when 'memberships' then array['wordId', 'listId'] when 'tracks' then array['itemId']
        when 'attempts' then array['itemId', 'trackId'] when 'timeEntries' then array['sessionId', 'localDate']
        else array[]::text[] end loop
        if jsonb_typeof(payload -> reference_key) is distinct from 'string'
          or length(trim(payload ->> reference_key)) not between 1 and 500 then
          raise exception 'Invalid reference field' using errcode = '22023';
        end if;
      end loop;
    end if;
    if collection_name in ('memberships', 'tracks') then
      referenced_word := case collection_name when 'memberships' then payload ->> 'wordId' else payload ->> 'itemId' end;
      shared_word := null;
      private_word := null;
      if payload is not null then
        if exists (select 1 from public.words where id = referenced_word) then
          shared_word := referenced_word;
        else
          private_word := referenced_word;
        end if;
      end if;
      execute format('insert into public.%I(user_id,id,data,revision,deleted,shared_word_id,private_word_id)
        values ($1,$2,$3,$4,$5,$6,$7) on conflict (user_id,id) do update set data=excluded.data,
        revision=excluded.revision,deleted=excluded.deleted,shared_word_id=excluded.shared_word_id,private_word_id=excluded.private_word_id', table_name)
        using member_id, record_id, payload, current_revision, payload is null, shared_word, private_word;
    else
      execute format('insert into public.%I(user_id,id,data,revision,deleted) values ($1,$2,$3,$4,$5)
        on conflict (user_id,id) do update set data=excluded.data,revision=excluded.revision,deleted=excluded.deleted', table_name)
        using member_id, record_id, payload, current_revision, payload is null;
    end if;
  end loop;
  update public.cloud_revisions set revision = current_revision where user_id = member_id;
  return jsonb_build_object('revision', current_revision);
end $$;

create function public.reserve_usage(p_user_id uuid, p_kind text, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  member public.app_memberships%rowtype;
  previous public.usage_events%rowtype;
  daily_limit integer;
  used_count integer;
  allowed boolean;
  remaining integer;
  today date := (current_timestamp at time zone 'UTC')::date;
begin
  if p_kind is null or p_kind not in ('deepseek', 'voice_session', 'voice_message') or p_request_id is null or p_user_id is null then
    raise exception 'Invalid usage reservation' using errcode = '22023';
  end if;
  -- Serialize all requests for this account, including concurrent duplicate ids.
  select * into member from public.app_memberships where user_id = p_user_id for update;
  if not found or not member.active then
    return jsonb_build_object('allowed', false, 'remaining', 0);
  end if;
  select * into previous from public.usage_events where user_id = p_user_id and request_id = p_request_id;
  if found then
    if previous.kind <> p_kind then
      raise exception 'Request id already used for another kind' using errcode = '22023';
    end if;
    return jsonb_build_object('allowed', previous.allowed, 'remaining', previous.remaining);
  end if;
  daily_limit := case p_kind when 'deepseek' then member.daily_deepseek_limit
    when 'voice_session' then member.daily_voice_session_limit else member.daily_voice_message_limit end;
  select count(*) into used_count from public.usage_events
    where user_id = p_user_id and kind = p_kind and usage_date = today and usage_events.allowed;
  allowed := used_count < daily_limit;
  remaining := greatest(daily_limit - used_count - case when allowed then 1 else 0 end, 0);
  insert into public.usage_events(user_id,request_id,kind,usage_date,allowed,remaining)
    values (p_user_id,p_request_id,p_kind,today,allowed,remaining);
  return jsonb_build_object('allowed', allowed, 'remaining', remaining);
end $$;

revoke all on function public.cloud_pull(bigint), public.cloud_apply(bigint,jsonb),
  public.reserve_usage(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.cloud_pull(bigint), public.cloud_apply(bigint,jsonb) to authenticated;
grant execute on function public.reserve_usage(uuid,text,uuid) to service_role;

commit;
