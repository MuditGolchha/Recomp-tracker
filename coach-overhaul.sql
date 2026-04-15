-- =============================================
-- COACH DASHBOARD OVERHAUL - Full Schema
-- =============================================

-- 1. PAYMENT TRACKING
CREATE TABLE IF NOT EXISTS client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES auth.users NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'NPR',
  payment_type text NOT NULL DEFAULT 'monthly', -- monthly, advance, partial, one_time
  status text NOT NULL DEFAULT 'pending', -- pending, paid, late, waived
  due_date date NOT NULL,
  paid_date date,
  months_covered integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_payments" ON client_payments
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Clients can view their own payment records
CREATE POLICY "client_view_payments" ON client_payments
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- 2. WORKOUT PROGRAMS (multi-week plans)
CREATE TABLE IF NOT EXISTS workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text,
  duration_weeks integer DEFAULT 4,
  status text DEFAULT 'active', -- active, completed, paused
  start_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_programs" ON workout_programs
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client_view_programs" ON workout_programs
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- 3. PLANNED WORKOUTS (scheduled on specific dates)
CREATE TABLE IF NOT EXISTS planned_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES workout_programs ON DELETE CASCADE,
  coach_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  scheduled_date date NOT NULL,
  week_number integer,
  day_of_week integer, -- 0=Sun, 1=Mon, etc.
  notes text,
  status text DEFAULT 'upcoming', -- upcoming, completed, missed, cancelled
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planned_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_planned_workouts" ON planned_workouts
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client_view_planned_workouts" ON planned_workouts
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Client can update status (mark as completed)
CREATE POLICY "client_update_planned_workouts" ON planned_workouts
  FOR UPDATE TO authenticated
  USING (client_id = auth.uid());

-- 4. PLANNED EXERCISES (exercises within a planned workout)
CREATE TABLE IF NOT EXISTS planned_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planned_workout_id uuid REFERENCES planned_workouts ON DELETE CASCADE NOT NULL,
  exercise_name text NOT NULL,
  sets integer DEFAULT 3,
  reps text DEFAULT '10', -- can be "8-12" or "10" or "AMRAP"
  weight_kg numeric,
  rest_seconds integer DEFAULT 90,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planned_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_planned_exercises" ON planned_exercises
  FOR ALL TO authenticated
  USING (
    planned_workout_id IN (
      SELECT id FROM planned_workouts WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    planned_workout_id IN (
      SELECT id FROM planned_workouts WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "client_view_planned_exercises" ON planned_exercises
  FOR SELECT TO authenticated
  USING (
    planned_workout_id IN (
      SELECT id FROM planned_workouts WHERE client_id = auth.uid()
    )
  );

-- 5. ATTENDANCE TRACKING
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users NOT NULL,
  client_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present', -- present, absent, late, excused
  planned_workout_id uuid REFERENCES planned_workouts,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_attendance" ON attendance
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client_view_attendance" ON attendance
  FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- 6. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  from_user_id uuid REFERENCES auth.users,
  type text NOT NULL, -- workout_reminder, payment_due, payment_late, coach_message, workout_assigned, attendance_marked
  title text NOT NULL,
  message text,
  link text, -- e.g. /gym, /progress, /payments
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_view_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Coaches can create notifications for their clients
CREATE POLICY "coach_create_notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND (
      user_id IN (
        SELECT client_id FROM coach_clients WHERE coach_id = auth.uid() AND status = 'active'
      )
      OR user_id = auth.uid()
    )
  );

-- 7. Add monthly_fee to coach_clients for tracking per-client pricing
ALTER TABLE coach_clients ADD COLUMN IF NOT EXISTS monthly_fee numeric DEFAULT 0;
ALTER TABLE coach_clients ADD COLUMN IF NOT EXISTS fee_currency text DEFAULT 'NPR';
ALTER TABLE coach_clients ADD COLUMN IF NOT EXISTS payment_day integer DEFAULT 1; -- day of month payment is due
ALTER TABLE coach_clients ADD COLUMN IF NOT EXISTS joined_date date DEFAULT CURRENT_DATE;

-- 8. Add notification_count to profiles for quick badge display
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unread_notifications integer DEFAULT 0;
