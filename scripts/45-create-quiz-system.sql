-- Quiz-based Corporate Team Building System
-- This creates the complete quiz module for corporate team building with monetary rewards

-- ============================================================================
-- STEP 1: Create Core Tables
-- ============================================================================

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  entry_fee_per_question NUMERIC NOT NULL CHECK (entry_fee_per_question > 0),
  max_participants INTEGER NOT NULL CHECK (max_participants > 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  total_cost NUMERIC NOT NULL, -- Calculated: entry_fee_per_question * total_questions * max_participants
  platform_fee_percentage NUMERIC DEFAULT 0.10, -- 10% for corporate quizzes
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'settled', 'cancelled')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  duration_minutes INTEGER, -- Time limit for completing the quiz
  randomize_questions BOOLEAN DEFAULT true, -- Prevent cheating by randomizing question order
  randomize_answers BOOLEAN DEFAULT true, -- Randomize answer options
  show_results_immediately BOOLEAN DEFAULT false, -- Show results after completion
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  settled_at TIMESTAMPTZ,
  settlement_method TEXT DEFAULT 'proportional' CHECK (settlement_method IN ('proportional', 'top_winners', 'equal_split')),
  top_winners_count INTEGER
);

-- Create quiz_questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false')),
  points NUMERIC DEFAULT 1, -- Points for correct answer
  order_index INTEGER NOT NULL, -- Order of question in quiz
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create quiz_answers table (correct answers)
CREATE TABLE IF NOT EXISTS quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL, -- Order of answer option
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create quiz_participants table (invited participants)
CREATE TABLE IF NOT EXISTS quiz_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'started', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score NUMERIC DEFAULT 0, -- Total points scored
  percentage_score NUMERIC DEFAULT 0, -- Percentage score
  rank INTEGER, -- Ranking among participants
  winnings NUMERIC DEFAULT 0, -- Amount won (calculated after settlement)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quiz_id, user_id) -- One entry per user per quiz
);

-- Create quiz_responses table (user answers)
CREATE TABLE IF NOT EXISTS quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES quiz_participants(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES quiz_answers(id) ON DELETE SET NULL, -- Selected answer
  is_correct BOOLEAN DEFAULT false,
  points_earned NUMERIC DEFAULT 0,
  response_text TEXT, -- For text-based answers (future use)
  answered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_id, question_id) -- One answer per question per participant
);

-- Create quiz_settlements table (track settlement history)
CREATE TABLE IF NOT EXISTS quiz_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  total_pool NUMERIC NOT NULL, -- Total amount collected
  platform_fee NUMERIC NOT NULL, -- Platform fee deducted
  winnings_pool NUMERIC NOT NULL, -- Amount distributed to winners
  participants_count INTEGER NOT NULL, -- Number of participants who completed
  settlement_method TEXT DEFAULT 'proportional' CHECK (settlement_method IN ('proportional', 'top_winners', 'equal_split')),
  top_winners_count INTEGER, -- If settlement_method is 'top_winners'
  settled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON quiz_questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question_id ON quiz_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_correct ON quiz_answers(question_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_quiz_id ON quiz_participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_user_id ON quiz_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_participants_status ON quiz_participants(quiz_id, status);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_participant_id ON quiz_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_question_id ON quiz_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_settlements_quiz_id ON quiz_settlements(quiz_id);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_settlements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS Policies (Permissive - Application handles auth)
-- ============================================================================

-- Quizzes policies
CREATE POLICY "public read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "users can create quizzes" ON quizzes FOR INSERT WITH CHECK (true); -- Application validates
CREATE POLICY "creators can update own quizzes" ON quizzes FOR UPDATE USING (true); -- Application validates
CREATE POLICY "creators can delete own quizzes" ON quizzes FOR DELETE USING (true); -- Application validates

-- Quiz questions policies
CREATE POLICY "public read quiz questions" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "creators can manage quiz questions" ON quiz_questions FOR ALL USING (true); -- Application validates

-- Quiz answers policies
CREATE POLICY "public read quiz answers" ON quiz_answers FOR SELECT USING (true);
CREATE POLICY "creators can manage quiz answers" ON quiz_answers FOR ALL USING (true); -- Application validates

-- Quiz participants policies
CREATE POLICY "public read quiz participants" ON quiz_participants FOR SELECT USING (true);
CREATE POLICY "users can manage own participation" ON quiz_participants FOR ALL USING (true); -- Application validates

-- Quiz responses policies
CREATE POLICY "participants can view own responses" ON quiz_responses FOR SELECT USING (true);
CREATE POLICY "participants can create own responses" ON quiz_responses FOR INSERT WITH CHECK (true); -- Application validates
CREATE POLICY "participants can update own responses" ON quiz_responses FOR UPDATE USING (true); -- Application validates

-- Quiz settlements policies
CREATE POLICY "public read quiz settlements" ON quiz_settlements FOR SELECT USING (true);
CREATE POLICY "system can create settlements" ON quiz_settlements FOR INSERT WITH CHECK (true); -- Application validates

-- ============================================================================
-- STEP 5: Create Helper Functions
-- ============================================================================

-- Function to calculate total cost for a quiz
CREATE OR REPLACE FUNCTION calculate_quiz_total_cost(
  entry_fee_per_question_param NUMERIC,
  total_questions_param INTEGER,
  max_participants_param INTEGER
)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
BEGIN
  RETURN entry_fee_per_question_param * total_questions_param * max_participants_param;
END;
$$;

-- Function to check if user has sufficient balance for quiz creation
CREATE OR REPLACE FUNCTION check_quiz_balance(
  user_id_param uuid,
  total_cost_param NUMERIC
)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  user_balance NUMERIC;
BEGIN
  SELECT balance INTO user_balance
  FROM profiles
  WHERE id = user_id_param;
  
  RETURN COALESCE(user_balance, 0) >= total_cost_param;
END;
$$;

-- Function to reserve funds for quiz creation
CREATE OR REPLACE FUNCTION reserve_quiz_funds(
  user_id_param uuid,
  amount_param NUMERIC,
  quiz_id_param uuid
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Deduct from balance
  UPDATE profiles
  SET balance = balance - amount_param
  WHERE id = user_id_param;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, type, amount, reference, description)
  VALUES (
    user_id_param,
    'quiz_creation',
    -amount_param,
    quiz_id_param::text,
    'Quiz creation - funds reserved'
  );
END;
$$;

-- Function to calculate participant score
CREATE OR REPLACE FUNCTION calculate_participant_score(
  participant_id_param uuid
)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  total_score NUMERIC;
BEGIN
  SELECT COALESCE(SUM(points_earned), 0) INTO total_score
  FROM quiz_responses
  WHERE participant_id = participant_id_param;
  
  RETURN total_score;
END;
$$;

-- Function to update participant score and percentage
CREATE OR REPLACE FUNCTION update_participant_score(
  participant_id_param uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  participant_record RECORD;
  total_score NUMERIC;
  total_possible_points NUMERIC;
  percentage_score NUMERIC;
BEGIN
  -- Get participant info
  SELECT qp.*, q.total_questions INTO participant_record
  FROM quiz_participants qp
  JOIN quizzes q ON q.id = qp.quiz_id
  WHERE qp.id = participant_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate total score
  total_score := calculate_participant_score(participant_id_param);
  
  -- Calculate total possible points (assuming 1 point per question)
  SELECT COALESCE(SUM(points), 0) INTO total_possible_points
  FROM quiz_questions
  WHERE quiz_id = participant_record.quiz_id;
  
  -- Calculate percentage
  IF total_possible_points > 0 THEN
    percentage_score := (total_score / total_possible_points) * 100;
  ELSE
    percentage_score := 0;
  END IF;
  
  -- Update participant
  UPDATE quiz_participants
  SET 
    score = total_score,
    percentage_score = percentage_score
  WHERE id = participant_id_param;
END;
$$;

-- Function to settle quiz and distribute winnings
CREATE OR REPLACE FUNCTION settle_quiz(quiz_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  quiz_record RECORD;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  participants_count INTEGER;
  participant_record RECORD;
  total_participants INTEGER;
  user_winnings NUMERIC;
  total_possible_points NUMERIC;
  settlement_method TEXT;
BEGIN
  -- Get quiz details
  SELECT * INTO quiz_record
  FROM quizzes
  WHERE id = quiz_id_param AND status IN ('completed', 'in_progress');
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Count completed participants
  SELECT COUNT(*) INTO participants_count
  FROM quiz_participants
  WHERE quiz_id = quiz_id_param AND status = 'completed';
  
  IF participants_count = 0 THEN
    -- No participants completed, refund creator
    PERFORM refund_quiz_funds(quiz_id_param);
    UPDATE quizzes SET status = 'cancelled' WHERE id = quiz_id_param;
    RETURN;
  END IF;
  
  -- Calculate total pool (entry_fee * questions * participants who completed)
  total_pool := quiz_record.entry_fee_per_question * quiz_record.total_questions * participants_count;
  
  -- Calculate platform fee
  platform_fee := total_pool * quiz_record.platform_fee_percentage;
  winnings_pool := total_pool - platform_fee;
  
  -- Get total possible points
  SELECT COALESCE(SUM(points), 0) INTO total_possible_points
  FROM quiz_questions
  WHERE quiz_id = quiz_id_param;
  
  -- Get settlement method (default to proportional)
  settlement_method := COALESCE(quiz_record.settlement_method, 'proportional');
  
  -- Distribute winnings based on settlement method
  IF settlement_method = 'proportional' THEN
    -- Proportional distribution based on score
    DECLARE
      total_score_sum NUMERIC;
    BEGIN
      -- Calculate sum of all scores
      SELECT COALESCE(SUM(score), 0) INTO total_score_sum
      FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed';
      
      IF total_score_sum > 0 THEN
        -- Distribute proportionally
        FOR participant_record IN
          SELECT * FROM quiz_participants
          WHERE quiz_id = quiz_id_param AND status = 'completed'
          ORDER BY score DESC, completed_at ASC
        LOOP
          user_winnings := (participant_record.score / total_score_sum) * winnings_pool;
          
          -- Add winnings to user balance
          PERFORM increment_balance(participant_record.user_id, user_winnings);
          
          -- Update participant winnings
          UPDATE quiz_participants
          SET winnings = user_winnings
          WHERE id = participant_record.id;
          
          -- Record transaction
          INSERT INTO transactions (user_id, type, amount, reference, description)
          VALUES (
            participant_record.user_id,
            'quiz_win',
            user_winnings,
            quiz_id_param::text,
            'Quiz Win: "' || quiz_record.title || '" - Score: ' || participant_record.score || '/' || total_possible_points
          );
        END LOOP;
      ELSE
        -- No scores, refund all participants
        PERFORM refund_quiz_participants(quiz_id_param);
      END IF;
    END;
  ELSIF settlement_method = 'top_winners' THEN
    -- Distribute to top N winners (equal split)
    DECLARE
      top_count INTEGER;
      winners_pool NUMERIC;
    BEGIN
      top_count := COALESCE(quiz_record.top_winners_count, 3);
      winners_pool := winnings_pool / top_count;
      
      FOR participant_record IN
        SELECT * FROM quiz_participants
        WHERE quiz_id = quiz_id_param AND status = 'completed'
        ORDER BY score DESC, completed_at ASC
        LIMIT top_count
      LOOP
        -- Add winnings to user balance
        PERFORM increment_balance(participant_record.user_id, winners_pool);
        
        -- Update participant winnings
        UPDATE quiz_participants
        SET winnings = winners_pool
        WHERE id = participant_record.id;
        
        -- Record transaction
        INSERT INTO transactions (user_id, type, amount, reference, description)
        VALUES (
          participant_record.user_id,
          'quiz_win',
          winners_pool,
          quiz_id_param::text,
          'Quiz Win: "' || quiz_record.title || '" - Top Winner'
        );
      END LOOP;
    END;
  ELSIF settlement_method = 'equal_split' THEN
    -- Equal split among all participants
    user_winnings := winnings_pool / participants_count;
    
    FOR participant_record IN
      SELECT * FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed'
    LOOP
      -- Add winnings to user balance
      PERFORM increment_balance(participant_record.user_id, user_winnings);
      
      -- Update participant winnings
      UPDATE quiz_participants
      SET winnings = user_winnings
      WHERE id = participant_record.id;
      
      -- Record transaction
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        participant_record.user_id,
        'quiz_win',
        user_winnings,
        quiz_id_param::text,
        'Quiz Win: "' || quiz_record.title || '" - Equal Split'
      );
    END LOOP;
  END IF;
  
  -- Record settlement
  INSERT INTO quiz_settlements (
    quiz_id,
    total_pool,
    platform_fee,
    winnings_pool,
    participants_count,
    settlement_method
  )
  VALUES (
    quiz_id_param,
    total_pool,
    platform_fee,
    winnings_pool,
    participants_count,
    settlement_method
  );
  
  -- Update quiz status
  UPDATE quizzes
  SET 
    status = 'settled',
    settled_at = now()
  WHERE id = quiz_id_param;
END;
$$;

-- Function to refund quiz funds to creator
CREATE OR REPLACE FUNCTION refund_quiz_funds(quiz_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  quiz_record RECORD;
  refund_amount NUMERIC;
BEGIN
  SELECT * INTO quiz_record
  FROM quizzes
  WHERE id = quiz_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  refund_amount := quiz_record.total_cost;
  
  -- Refund to creator
  PERFORM increment_balance(quiz_record.creator_id, refund_amount);
  
  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, reference, description)
  VALUES (
    quiz_record.creator_id,
    'quiz_refund',
    refund_amount,
    quiz_id_param::text,
    'Quiz Refund: "' || quiz_record.title || '" - No participants completed'
  );
END;
$$;

-- Function to refund quiz participants
CREATE OR REPLACE FUNCTION refund_quiz_participants(quiz_id_param uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  quiz_record RECORD;
  participant_record RECORD;
  refund_amount NUMERIC;
BEGIN
  SELECT * INTO quiz_record
  FROM quizzes
  WHERE id = quiz_id_param;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  refund_amount := quiz_record.entry_fee_per_question * quiz_record.total_questions;
  
  -- Refund each participant
  FOR participant_record IN
    SELECT * FROM quiz_participants
    WHERE quiz_id = quiz_id_param AND status = 'completed'
  LOOP
    PERFORM increment_balance(participant_record.user_id, refund_amount);
    
    INSERT INTO transactions (user_id, type, amount, reference, description)
    VALUES (
      participant_record.user_id,
      'quiz_refund',
      refund_amount,
      quiz_id_param::text,
      'Quiz Refund: "' || quiz_record.title || '"'
    );
  END LOOP;
END;
$$;

-- Function to check and settle completed quizzes
CREATE OR REPLACE FUNCTION check_and_settle_completed_quizzes()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  quiz_record RECORD;
BEGIN
  -- Find quizzes that are completed but not settled
  FOR quiz_record IN
    SELECT * FROM quizzes
    WHERE status = 'completed'
      AND settled_at IS NULL
      AND end_date IS NOT NULL
      AND end_date <= now()
  LOOP
    PERFORM settle_quiz(quiz_record.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 6: Create Triggers
-- ============================================================================

-- Trigger to update participant score when response is submitted
CREATE OR REPLACE FUNCTION trigger_update_participant_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM update_participant_score(NEW.participant_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_participant_score_trigger
  AFTER INSERT OR UPDATE ON quiz_responses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_participant_score();

-- Trigger to update quiz updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_quiz_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_quiz_timestamp_trigger
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_quiz_timestamp();

-- ============================================================================
-- STEP 7: Add any additional indexes or constraints if needed
-- ============================================================================

