-- ============================================
-- Coach Dashboard Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Coach-Client relationships
create table public.coach_clients (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references auth.users on delete cascade not null,
  client_id uuid references auth.users on delete cascade not null,
  status text default 'active' check (status in ('active', 'paused', 'removed')),
  added_at timestamptz default now(),
  unique(coach_id, client_id)
);

alter table public.coach_clients enable row level security;

-- Coaches can see their own clients
create policy "Coaches can view own clients"
  on public.coach_clients for select using (auth.uid() = coach_id);
create policy "Coaches can add clients"
  on public.coach_clients for insert with check (auth.uid() = coach_id);
create policy "Coaches can update own clients"
  on public.coach_clients for update using (auth.uid() = coach_id);
create policy "Coaches can delete own clients"
  on public.coach_clients for delete using (auth.uid() = coach_id);

-- Coach notes on clients
create table public.coach_notes (
  id uuid default uuid_generate_v4() primary key,
  coach_id uuid references auth.users on delete cascade not null,
  client_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.coach_notes enable row level security;

create policy "Coaches can manage own notes"
  on public.coach_notes for all using (auth.uid() = coach_id);

-- Add is_coach flag to profiles
alter table public.profiles add column if not exists is_coach boolean default false;

-- Function to link client to coach via share token
create or replace function public.link_client_to_coach(share_token_input text)
returns json as $$
declare
  target_client_id uuid;
  client_name text;
begin
  select id, full_name into target_client_id, client_name
  from public.profiles
  where trainer_share_token = share_token_input;

  if target_client_id is null then
    return json_build_object('error', 'Invalid share token');
  end if;

  if target_client_id = auth.uid() then
    return json_build_object('error', 'Cannot add yourself as a client');
  end if;

  insert into public.coach_clients (coach_id, client_id)
  values (auth.uid(), target_client_id)
  on conflict (coach_id, client_id) do update set status = 'active';

  -- Mark user as coach
  update public.profiles set is_coach = true where id = auth.uid();

  return json_build_object('success', true, 'client_name', client_name);
end;
$$ language plpgsql security definer;

-- Function to get full client data for coach
create or replace function public.get_client_data(client_user_id uuid)
returns json as $$
declare
  result json;
  is_linked boolean;
begin
  -- Verify coach has access to this client
  select exists(
    select 1 from public.coach_clients
    where coach_id = auth.uid() and client_id = client_user_id and status = 'active'
  ) into is_linked;

  if not is_linked then
    return json_build_object('error', 'Not authorized');
  end if;

  select json_build_object(
    'profile', (select row_to_json(p) from public.profiles p where p.id = client_user_id),
    'food_log_7d', (
      select json_agg(row_to_json(f) order by f.logged_at desc, f.created_at desc)
      from public.food_log f
      where f.user_id = client_user_id
      and f.logged_at >= current_date - interval '7 days'
    ),
    'food_log_30d_summary', (
      select json_agg(row_to_json(daily))
      from (
        select logged_at, sum(calories) as total_cal, sum(protein_g) as total_protein,
               sum(carbs_g) as total_carbs, sum(fat_g) as total_fat
        from public.food_log
        where user_id = client_user_id and logged_at >= current_date - interval '30 days'
        group by logged_at order by logged_at
      ) daily
    ),
    'workouts', (
      select json_agg(row_to_json(w) order by w.workout_date desc)
      from public.workout_sessions w
      where w.user_id = client_user_id
      and w.workout_date >= current_date - interval '30 days'
    ),
    'workout_sets', (
      select json_agg(row_to_json(ws))
      from public.workout_sets ws
      inner join public.workout_sessions w on w.id = ws.session_id
      where w.user_id = client_user_id
      and w.workout_date >= current_date - interval '30 days'
    ),
    'sleep', (
      select json_agg(row_to_json(s) order by s.sleep_date desc)
      from public.sleep_log s
      where s.user_id = client_user_id
      and s.sleep_date >= current_date - interval '30 days'
    ),
    'progress', (
      select json_agg(row_to_json(wp) order by wp.recorded_date desc)
      from public.weekly_progress wp
      where wp.user_id = client_user_id
    ),
    'coach_notes', (
      select json_agg(row_to_json(cn) order by cn.created_at desc)
      from public.coach_notes cn
      where cn.client_id = client_user_id and cn.coach_id = auth.uid()
    )
  ) into result;

  return result;
end;
$$ language plpgsql security definer;
