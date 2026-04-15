-- =============================================
-- WORKOUT CHANGE REQUESTS TABLE
-- Allows clients to request changes to planned workouts
-- =============================================

CREATE TABLE IF NOT EXISTS workout_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_workout_id uuid REFERENCES planned_workouts ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES auth.users NOT NULL,
  coach_id uuid REFERENCES auth.users NOT NULL,
  message text NOT NULL,
  coach_reply text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, declined
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workout_change_requests ENABLE ROW LEVEL SECURITY;

-- Client can view and create their own change requests
CREATE POLICY "client_manage_change_requests" ON workout_change_requests
  FOR ALL TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Coach can view and respond to change requests for their clients
CREATE POLICY "coach_manage_change_requests" ON workout_change_requests
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
