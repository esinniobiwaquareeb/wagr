-- Refund unused reserved quiz funds back to the creator when fewer participants complete the quiz

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
  reserved_base_cost NUMERIC;
  remaining_base_refund NUMERIC;
BEGIN
  -- Get quiz details
  SELECT * INTO quiz_record
  FROM quizzes
  WHERE id = quiz_id_param AND status IN ('completed', 'in_progress', 'open');
  
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
  
  -- Record unused reserved base cost and refund to creator if necessary
  reserved_base_cost := COALESCE(quiz_record.base_cost, quiz_record.entry_fee_per_question * quiz_record.total_questions * quiz_record.max_participants);
  remaining_base_refund := GREATEST(reserved_base_cost - total_pool, 0);
  
  IF remaining_base_refund > 0 THEN
    PERFORM increment_balance(quiz_record.creator_id, remaining_base_refund);
    
    INSERT INTO transactions (user_id, type, amount, reference, description)
    VALUES (
      quiz_record.creator_id,
      'quiz_refund',
      remaining_base_refund,
      quiz_id_param::text,
      'Unused quiz funds refunded after settlement'
    );
  END IF;

  -- Existing settlement logic continues below (unchanged aside from new variables)
  SELECT COALESCE(SUM(points), 0) INTO total_possible_points
  FROM quiz_questions
  WHERE quiz_id = quiz_id_param;

  IF total_possible_points = 0 THEN
    SELECT COALESCE(SUM(points_earned), 0) INTO total_possible_points
    FROM quiz_responses qr
    WHERE qr.quiz_id = quiz_id_param;
  END IF;

  settlement_method := quiz_record.settlement_method;

  IF settlement_method = 'proportional' THEN
    total_participants := participants_count;
    
    FOR participant_record IN
      SELECT * FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed'
    LOOP
      user_winnings := CASE 
        WHEN total_possible_points > 0 THEN
          (participant_record.score / total_possible_points) * winnings_pool
        ELSE winnings_pool / total_participants
      END;
      
      PERFORM increment_balance(participant_record.user_id, user_winnings);
      
      UPDATE quiz_participants
      SET winnings = user_winnings
      WHERE id = participant_record.id;
      
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        participant_record.user_id,
        'quiz_win',
        user_winnings,
        quiz_id_param::text,
        'Quiz Win: "' || quiz_record.title || '" - Proportional'
      );
    END LOOP;
  ELSIF settlement_method = 'top_winners' THEN
    total_participants := participants_count;
    
    IF quiz_record.top_winners_count IS NULL OR quiz_record.top_winners_count < 1 THEN
      quiz_record.top_winners_count := 3;
    END IF;
    
    user_winnings := winnings_pool / quiz_record.top_winners_count;
    
    FOR participant_record IN
      SELECT *
      FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed'
      ORDER BY score DESC, completed_at ASC
      LIMIT quiz_record.top_winners_count
    LOOP
      PERFORM increment_balance(participant_record.user_id, user_winnings);
      
      UPDATE quiz_participants
      SET winnings = user_winnings
      WHERE id = participant_record.id;
      
      INSERT INTO transactions (user_id, type, amount, reference, description)
      VALUES (
        participant_record.user_id,
        'quiz_win',
        user_winnings,
        quiz_id_param::text,
        'Quiz Win: "' || quiz_record.title || '" - Top Winner'
      );
    END LOOP;
  ELSIF settlement_method = 'equal_split' THEN
    user_winnings := winnings_pool / participants_count;
    
    FOR participant_record IN
      SELECT * FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed'
    LOOP
      PERFORM increment_balance(participant_record.user_id, user_winnings);
      
      UPDATE quiz_participants
      SET winnings = user_winnings
      WHERE id = participant_record.id;
      
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
  
  UPDATE quizzes
  SET 
    status = 'settled',
    settled_at = now()
  WHERE id = quiz_id_param;
END;
$$;

