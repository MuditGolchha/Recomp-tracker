-- Add onboarding fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_type text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_type text DEFAULT 'vegetarian';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level text DEFAULT 'moderate';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'beginner';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS start_weight_kg numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_weight_kg numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deadline date;

-- Update existing users to have onboarding_completed = true (so they skip it)
UPDATE profiles SET onboarding_completed = true WHERE id IS NOT NULL;

-- Add RLS policy so coaches can insert workout_sessions and workout_sets for clients
CREATE POLICY "coach_insert_workout_sessions" ON workout_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT client_id FROM coach_clients
      WHERE coach_id = auth.uid() AND status = 'active'
    )
    OR user_id = auth.uid()
  );

-- Allow coaches to insert workout_sets for their clients' sessions
CREATE POLICY "coach_insert_workout_sets" ON workout_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT ws.id FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE cc.coach_id = auth.uid() AND cc.status = 'active'
    )
    OR session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = auth.uid()
    )
  );

-- Allow coaches to update workout_sessions for their clients
CREATE POLICY "coach_update_workout_sessions" ON workout_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id IN (
      SELECT client_id FROM coach_clients
      WHERE coach_id = auth.uid() AND status = 'active'
    )
    OR user_id = auth.uid()
  );

-- Allow coaches to delete workout_sets for their clients
CREATE POLICY "coach_delete_workout_sets" ON workout_sets
  FOR DELETE TO authenticated
  USING (
    session_id IN (
      SELECT ws.id FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE cc.coach_id = auth.uid() AND cc.status = 'active'
    )
    OR session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = auth.uid()
    )
  );
