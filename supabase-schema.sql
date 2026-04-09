-- ============================================
-- Recomp Tracker - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  height_cm numeric,
  start_weight_kg numeric,
  target_calories int default 1950,
  target_protein_g int default 130,
  target_carbs_g int default 175,
  target_fat_g int default 55,
  goal text default 'recomp',
  is_vegetarian boolean default true,
  trainer_share_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- FOOD DATABASE (community + personal)
-- ============================================
create table public.foods (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  brand text,
  serving_size text default '100g',
  calories_per_serving numeric not null,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  fiber_g numeric default 0,
  is_common boolean default false,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

alter table public.foods enable row level security;

create policy "Anyone can view foods"
  on public.foods for select using (true);
create policy "Users can add foods"
  on public.foods for insert with check (auth.uid() = created_by);

-- ============================================
-- FOOD LOG (daily nutrition tracking)
-- ============================================
create table public.food_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  food_id uuid references public.foods,
  custom_name text,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  servings numeric default 1,
  calories numeric not null,
  protein_g numeric default 0,
  carbs_g numeric default 0,
  fat_g numeric default 0,
  logged_at date default current_date,
  created_at timestamptz default now()
);

alter table public.food_log enable row level security;

create policy "Users can view own food log"
  on public.food_log for select using (auth.uid() = user_id);
create policy "Users can insert own food log"
  on public.food_log for insert with check (auth.uid() = user_id);
create policy "Users can update own food log"
  on public.food_log for update using (auth.uid() = user_id);
create policy "Users can delete own food log"
  on public.food_log for delete using (auth.uid() = user_id);

-- ============================================
-- EXERCISES (exercise library)
-- ============================================
create table public.exercises (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  muscle_group text,
  category text check (category in ('compound', 'isolation', 'cardio', 'flexibility')),
  is_common boolean default false,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

alter table public.exercises enable row level security;

create policy "Anyone can view exercises"
  on public.exercises for select using (true);
create policy "Users can add exercises"
  on public.exercises for insert with check (auth.uid() = created_by);

-- ============================================
-- WORKOUT SESSIONS
-- ============================================
create table public.workout_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text,
  workout_date date default current_date,
  duration_minutes int,
  notes text,
  created_at timestamptz default now()
);

alter table public.workout_sessions enable row level security;

create policy "Users can manage own workouts"
  on public.workout_sessions for all using (auth.uid() = user_id);

-- ============================================
-- WORKOUT SETS (individual sets within a session)
-- ============================================
create table public.workout_sets (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.workout_sessions on delete cascade not null,
  exercise_id uuid references public.exercises,
  exercise_name text,
  set_number int not null,
  reps int,
  weight_kg numeric,
  duration_seconds int,
  rpe numeric,
  created_at timestamptz default now()
);

alter table public.workout_sets enable row level security;

create policy "Users can manage own sets"
  on public.workout_sets for all
  using (
    exists (
      select 1 from public.workout_sessions ws
      where ws.id = session_id and ws.user_id = auth.uid()
    )
  );

-- ============================================
-- SLEEP LOG
-- ============================================
create table public.sleep_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  sleep_date date default current_date,
  bedtime time,
  wake_time time,
  duration_hours numeric,
  quality int check (quality between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, sleep_date)
);

alter table public.sleep_log enable row level security;

create policy "Users can manage own sleep log"
  on public.sleep_log for all using (auth.uid() = user_id);

-- ============================================
-- WEEKLY PROGRESS (weight, waist, photos)
-- ============================================
create table public.weekly_progress (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  recorded_date date default current_date,
  weight_kg numeric,
  waist_cm numeric,
  body_fat_pct numeric,
  notes text,
  created_at timestamptz default now()
);

alter table public.weekly_progress enable row level security;

create policy "Users can manage own progress"
  on public.weekly_progress for all using (auth.uid() = user_id);

-- ============================================
-- PROGRESS PHOTOS
-- ============================================
create table public.progress_photos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  progress_id uuid references public.weekly_progress on delete cascade,
  photo_url text not null,
  photo_type text check (photo_type in ('front', 'side', 'back')),
  taken_at date default current_date,
  created_at timestamptz default now()
);

alter table public.progress_photos enable row level security;

create policy "Users can manage own photos"
  on public.progress_photos for all using (auth.uid() = user_id);

-- ============================================
-- AI COACH CONVERSATIONS
-- ============================================
create table public.coach_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.coach_messages enable row level security;

create policy "Users can manage own messages"
  on public.coach_messages for all using (auth.uid() = user_id);

-- ============================================
-- TRAINER VIEW: allow read access via share token
-- ============================================
create or replace function public.get_trainer_view(share_token text)
returns json as $$
declare
  target_user_id uuid;
  result json;
begin
  select id into target_user_id
  from public.profiles
  where trainer_share_token = share_token;

  if target_user_id is null then
    return null;
  end if;

  select json_build_object(
    'profile', (select row_to_json(p) from public.profiles p where p.id = target_user_id),
    'recent_food_log', (
      select json_agg(row_to_json(f))
      from public.food_log f
      where f.user_id = target_user_id
      and f.logged_at >= current_date - interval '7 days'
    ),
    'recent_workouts', (
      select json_agg(row_to_json(w))
      from public.workout_sessions w
      where w.user_id = target_user_id
      and w.workout_date >= current_date - interval '7 days'
    ),
    'recent_sleep', (
      select json_agg(row_to_json(s))
      from public.sleep_log s
      where s.user_id = target_user_id
      and s.sleep_date >= current_date - interval '7 days'
    ),
    'progress', (
      select json_agg(row_to_json(wp))
      from public.weekly_progress wp
      where wp.user_id = target_user_id
      order by wp.recorded_date desc
      limit 12
    )
  ) into result;

  return result;
end;
$$ language plpgsql security definer;

-- ============================================
-- SEED: Common Indian Vegetarian Foods
-- ============================================
insert into public.foods (name, brand, serving_size, calories_per_serving, protein_g, carbs_g, fat_g, is_common) values
  ('Dal (Moong)', null, '1 cup cooked (200g)', 210, 14, 35, 1, true),
  ('Dal (Masoor)', null, '1 cup cooked (200g)', 230, 18, 40, 0.8, true),
  ('Dal (Toor/Arhar)', null, '1 cup cooked (200g)', 240, 16, 40, 1, true),
  ('Chana Dal', null, '1 cup cooked (200g)', 280, 18, 44, 4, true),
  ('Rajma (Kidney Beans)', null, '1 cup cooked (200g)', 225, 15, 40, 0.8, true),
  ('Chole (Chickpeas)', null, '1 cup cooked (200g)', 270, 15, 45, 4, true),
  ('Paneer', null, '100g', 265, 18, 1, 21, true),
  ('Roti (Wheat)', null, '1 medium (40g)', 120, 3, 20, 3, true),
  ('Rice (White, cooked)', null, '1 cup (200g)', 240, 4, 53, 0.4, true),
  ('Rice (Brown, cooked)', null, '1 cup (200g)', 215, 5, 45, 1.8, true),
  ('Dahi (Curd/Yogurt)', null, '1 cup (200g)', 120, 8, 10, 5, true),
  ('Greek Yogurt', null, '1 cup (200g)', 130, 20, 8, 0.7, true),
  ('Milk (Full Fat)', null, '1 glass (250ml)', 160, 8, 12, 8, true),
  ('Milk (Toned)', null, '1 glass (250ml)', 120, 8, 12, 3, true),
  ('Whey Protein Scoop', 'ON Gold Standard', '1 scoop (32g)', 120, 24, 3, 1, true),
  ('Soya Chunks', null, '1 cup cooked (100g dry)', 336, 52, 33, 0.5, true),
  ('Tofu', null, '100g', 76, 8, 2, 4.5, true),
  ('Egg (Boiled)', null, '1 large', 78, 6, 0.6, 5, true),
  ('Peanut Butter', null, '2 tbsp (32g)', 188, 8, 6, 16, true),
  ('Almonds', null, '28g (23 nuts)', 164, 6, 6, 14, true),
  ('Banana', null, '1 medium (120g)', 105, 1.3, 27, 0.4, true),
  ('Apple', null, '1 medium (180g)', 95, 0.5, 25, 0.3, true),
  ('Aloo Gobi', null, '1 cup (200g)', 180, 5, 24, 8, true),
  ('Palak Paneer', null, '1 cup (200g)', 290, 14, 8, 22, true),
  ('Idli', null, '2 pieces', 130, 4, 26, 0.5, true),
  ('Dosa (Plain)', null, '1 medium', 170, 4, 28, 5, true),
  ('Upma', null, '1 cup (200g)', 210, 5, 30, 8, true),
  ('Poha', null, '1 cup (200g)', 250, 5, 40, 8, true),
  ('Paratha (Plain)', null, '1 medium (60g)', 200, 4, 25, 10, true),
  ('Samosa', null, '1 piece', 260, 4, 30, 14, true),
  ('Lassi (Sweet)', null, '1 glass (250ml)', 175, 6, 28, 4, true),
  ('Chach/Buttermilk', null, '1 glass (250ml)', 40, 2, 5, 1, true),
  ('Sprouts (Mixed)', null, '1 cup (100g)', 100, 7, 15, 1, true),
  ('Sattu', null, '2 tbsp (30g)', 110, 7, 18, 1.5, true),
  ('Makhana (Fox Nuts)', null, '1 cup (30g)', 105, 3, 18, 0.3, true),
  ('Oats (cooked)', null, '1 cup (240g)', 150, 5, 27, 2.5, true),
  ('Peanuts (roasted)', null, '28g', 161, 7, 5, 14, true),
  ('Chapati/Phulka', null, '1 (30g)', 70, 2, 12, 1.5, true);

-- ============================================
-- SEED: Common Exercises
-- ============================================
insert into public.exercises (name, muscle_group, category, is_common) values
  ('Barbell Bench Press', 'Chest', 'compound', true),
  ('Incline Dumbbell Press', 'Chest', 'compound', true),
  ('Push Ups', 'Chest', 'compound', true),
  ('Cable Flyes', 'Chest', 'isolation', true),
  ('Barbell Squat', 'Legs', 'compound', true),
  ('Leg Press', 'Legs', 'compound', true),
  ('Romanian Deadlift', 'Legs', 'compound', true),
  ('Leg Curl', 'Legs', 'isolation', true),
  ('Leg Extension', 'Legs', 'isolation', true),
  ('Calf Raises', 'Legs', 'isolation', true),
  ('Deadlift', 'Back', 'compound', true),
  ('Barbell Row', 'Back', 'compound', true),
  ('Pull Ups', 'Back', 'compound', true),
  ('Lat Pulldown', 'Back', 'compound', true),
  ('Seated Cable Row', 'Back', 'compound', true),
  ('Face Pulls', 'Back', 'isolation', true),
  ('Overhead Press', 'Shoulders', 'compound', true),
  ('Lateral Raises', 'Shoulders', 'isolation', true),
  ('Front Raises', 'Shoulders', 'isolation', true),
  ('Rear Delt Flyes', 'Shoulders', 'isolation', true),
  ('Barbell Curl', 'Arms', 'isolation', true),
  ('Dumbbell Curl', 'Arms', 'isolation', true),
  ('Hammer Curl', 'Arms', 'isolation', true),
  ('Tricep Pushdown', 'Arms', 'isolation', true),
  ('Skull Crushers', 'Arms', 'isolation', true),
  ('Overhead Tricep Extension', 'Arms', 'isolation', true),
  ('Plank', 'Core', 'isolation', true),
  ('Hanging Leg Raises', 'Core', 'isolation', true),
  ('Cable Crunches', 'Core', 'isolation', true),
  ('Russian Twists', 'Core', 'isolation', true),
  ('Treadmill', 'Cardio', 'cardio', true),
  ('Cycling', 'Cardio', 'cardio', true),
  ('Jump Rope', 'Cardio', 'cardio', true);

-- Create storage bucket for progress photos
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict do nothing;

create policy "Users can upload own photos"
  on storage.objects for insert
  with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view photos"
  on storage.objects for select
  using (bucket_id = 'progress-photos');
