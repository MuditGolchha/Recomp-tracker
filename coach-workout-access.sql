-- =============================================
-- Coach <> Client live workout RLS policies
-- Run this in Supabase SQL Editor
-- =============================================

-- 1) Coach can INSERT/UPDATE/SELECT workout_sessions for their active clients
DROP POLICY IF EXISTS "coach_insert_client_sessions" ON workout_sessions;
CREATE POLICY "coach_insert_client_sessions"
  ON workout_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.coach_id = auth.uid()
        AND coach_clients.client_id = workout_sessions.user_id
        AND coach_clients.status = 'active'
    )
  );

DROP POLICY IF EXISTS "coach_update_client_sessions" ON workout_sessions;
CREATE POLICY "coach_update_client_sessions"
  ON workout_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.coach_id = auth.uid()
        AND coach_clients.client_id = workout_sessions.user_id
        AND coach_clients.status = 'active'
    )
  );

DROP POLICY IF EXISTS "coach_select_client_sessions" ON workout_sessions;
CREATE POLICY "coach_select_client_sessions"
  ON workout_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.coach_id = auth.uid()
        AND coach_clients.client_id = workout_sessions.user_id
        AND coach_clients.status = 'active'
    )
  );

-- 2) Coach can INSERT/UPDATE/DELETE/SELECT workout_sets for their client's sessions
DROP POLICY IF EXISTS "coach_insert_client_sets" ON workout_sets;
CREATE POLICY "coach_insert_client_sets"
  ON workout_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE ws.id = workout_sets.session_id
        AND cc.coach_id = auth.uid()
        AND cc.status = 'active'
    )
  );

DROP POLICY IF EXISTS "coach_update_client_sets" ON workout_sets;
CREATE POLICY "coach_update_client_sets"
  ON workout_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE ws.id = workout_sets.session_id
        AND cc.coach_id = auth.uid()
        AND cc.status = 'active'
    )
  );

DROP POLICY IF EXISTS "coach_delete_client_sets" ON workout_sets;
CREATE POLICY "coach_delete_client_sets"
  ON workout_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE ws.id = workout_sets.session_id
        AND cc.coach_id = auth.uid()
        AND cc.status = 'active'
    )
  );

DROP POLICY IF EXISTS "coach_select_client_sets" ON workout_sets;
CREATE POLICY "coach_select_client_sets"
  ON workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      JOIN coach_clients cc ON cc.client_id = ws.user_id
      WHERE ws.id = workout_sets.session_id
        AND cc.coach_id = auth.uid()
        AND cc.status = 'active'
    )
  );

-- 3) Client can SELECT their coach's profile so the name/info shows up
DROP POLICY IF EXISTS "client_select_coach_profile" ON profiles;
CREATE POLICY "client_select_coach_profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.coach_id = profiles.id
        AND coach_clients.client_id = auth.uid()
        AND coach_clients.status = 'active'
    )
  );

-- 4) Coach can also SELECT their client's profile (for dashboard)
DROP POLICY IF EXISTS "coach_select_client_profile" ON profiles;
CREATE POLICY "coach_select_client_profile"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.client_id = profiles.id
        AND coach_clients.coach_id = auth.uid()
        AND coach_clients.status = 'active'
    )
  );
