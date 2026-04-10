-- Fix 1: Change share tokens from long hex to simple 6-digit codes
-- Update existing profiles to use short codes
UPDATE public.profiles
SET trainer_share_token = LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0')
WHERE trainer_share_token IS NOT NULL;

-- Change the default for new profiles
ALTER TABLE public.profiles
ALTER COLUMN trainer_share_token SET DEFAULT LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');

-- Update the trigger function to generate short codes for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, trainer_share_token)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 2: Update link_client_to_coach to work with short codes
CREATE OR REPLACE FUNCTION public.link_client_to_coach(share_token_input text)
RETURNS json AS $$
DECLARE
  target_client_id uuid;
  client_name text;
BEGIN
  SELECT id, full_name INTO target_client_id, client_name
  FROM public.profiles
  WHERE trainer_share_token = share_token_input;

  IF target_client_id IS NULL THEN
    RETURN json_build_object('error', 'Invalid code. Ask your client for their 6-digit share code.');
  END IF;

  IF target_client_id = auth.uid() THEN
    RETURN json_build_object('error', 'Cannot add yourself as a client');
  END IF;

  INSERT INTO public.coach_clients (coach_id, client_id)
  VALUES (auth.uid(), target_client_id)
  ON CONFLICT (coach_id, client_id) DO UPDATE SET status = 'active';

  UPDATE public.profiles SET is_coach = true WHERE id = auth.uid();

  RETURN json_build_object('success', true, 'client_name', client_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 3: Rewrite get_client_data to be more robust
CREATE OR REPLACE FUNCTION public.get_client_data(client_user_id uuid)
RETURNS json AS $$
DECLARE
  result json;
  is_linked boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.coach_clients
    WHERE coach_id = auth.uid() AND client_id = client_user_id AND status = 'active'
  ) INTO is_linked;

  IF NOT is_linked THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  SELECT json_build_object(
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = client_user_id),
    'food_log_7d', COALESCE((
      SELECT json_agg(row_to_json(f))
      FROM (
        SELECT * FROM public.food_log
        WHERE user_id = client_user_id AND logged_at >= current_date - interval '7 days'
        ORDER BY logged_at DESC, created_at DESC
      ) f
    ), '[]'::json),
    'food_log_30d_summary', COALESCE((
      SELECT json_agg(row_to_json(daily))
      FROM (
        SELECT logged_at, sum(calories) as total_cal, sum(protein_g) as total_protein,
               sum(carbs_g) as total_carbs, sum(fat_g) as total_fat
        FROM public.food_log
        WHERE user_id = client_user_id AND logged_at >= current_date - interval '30 days'
        GROUP BY logged_at ORDER BY logged_at
      ) daily
    ), '[]'::json),
    'workouts', COALESCE((
      SELECT json_agg(row_to_json(w))
      FROM (
        SELECT * FROM public.workout_sessions
        WHERE user_id = client_user_id AND workout_date >= current_date - interval '30 days'
        ORDER BY workout_date DESC
      ) w
    ), '[]'::json),
    'workout_sets', COALESCE((
      SELECT json_agg(row_to_json(ws))
      FROM public.workout_sets ws
      INNER JOIN public.workout_sessions w ON w.id = ws.session_id
      WHERE w.user_id = client_user_id
      AND w.workout_date >= current_date - interval '30 days'
    ), '[]'::json),
    'sleep', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (
        SELECT * FROM public.sleep_log
        WHERE user_id = client_user_id AND sleep_date >= current_date - interval '30 days'
        ORDER BY sleep_date DESC
      ) s
    ), '[]'::json),
    'progress', COALESCE((
      SELECT json_agg(row_to_json(wp))
      FROM (
        SELECT * FROM public.weekly_progress
        WHERE user_id = client_user_id
        ORDER BY recorded_date DESC
      ) wp
    ), '[]'::json),
    'coach_notes', COALESCE((
      SELECT json_agg(row_to_json(cn))
      FROM (
        SELECT * FROM public.coach_notes
        WHERE client_id = client_user_id AND coach_id = auth.uid()
        ORDER BY created_at DESC
      ) cn
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix 4: Update get_trainer_view for the preview feature
CREATE OR REPLACE FUNCTION public.get_trainer_view(share_token text)
RETURNS json AS $$
DECLARE
  target_user_id uuid;
  result json;
BEGIN
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE trainer_share_token = share_token;

  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = target_user_id),
    'recent_food_log', COALESCE((
      SELECT json_agg(row_to_json(f))
      FROM public.food_log f
      WHERE f.user_id = target_user_id
      AND f.logged_at >= current_date - interval '7 days'
    ), '[]'::json),
    'recent_workouts', COALESCE((
      SELECT json_agg(row_to_json(w))
      FROM public.workout_sessions w
      WHERE w.user_id = target_user_id
      AND w.workout_date >= current_date - interval '7 days'
    ), '[]'::json),
    'recent_sleep', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM public.sleep_log s
      WHERE s.user_id = target_user_id
      AND s.sleep_date >= current_date - interval '7 days'
    ), '[]'::json),
    'progress', COALESCE((
      SELECT json_agg(row_to_json(wp))
      FROM (
        SELECT * FROM public.weekly_progress wp
        WHERE wp.user_id = target_user_id
        ORDER BY wp.recorded_date DESC
        LIMIT 12
      ) wp
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
