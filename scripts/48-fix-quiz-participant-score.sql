-- Fix ambiguous column reference when updating quiz participant scores
-- Ensures percentage_score variable does not conflict with column name

CREATE OR REPLACE FUNCTION update_participant_score(
  participant_id_param uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  participant_record RECORD;
  total_score NUMERIC;
  total_possible_points NUMERIC;
  calculated_percentage NUMERIC;
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
  
  -- Calculate total possible points (sum of question points)
  SELECT COALESCE(SUM(points), 0) INTO total_possible_points
  FROM quiz_questions
  WHERE quiz_id = participant_record.quiz_id;
  
  -- Calculate percentage
  IF total_possible_points > 0 THEN
    calculated_percentage := (total_score / total_possible_points) * 100;
  ELSE
    calculated_percentage := 0;
  END IF;
  
  -- Update participant with explicit variable usage
  UPDATE quiz_participants
  SET 
    score = total_score,
    percentage_score = calculated_percentage
  WHERE id = participant_id_param;
END;
$$;

