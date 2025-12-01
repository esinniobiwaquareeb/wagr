-- Fix quiz settlement calculation to ensure proper rounding and precision
-- This ensures participants get the correct amount and creator gets proper refund

CREATE OR REPLACE FUNCTION settle_quiz(quiz_id_param uuid)
RETURNS void LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  quiz_record RECORD;
  participants_count INTEGER;
  total_pool NUMERIC;
  platform_fee NUMERIC;
  winnings_pool NUMERIC;
  reserved_base_cost NUMERIC;
  remaining_base_refund NUMERIC;
  total_possible_points NUMERIC;
  settlement_method TEXT;
  user_winnings NUMERIC;
  total_distributed NUMERIC := 0;
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
  platform_fee := ROUND(total_pool * quiz_record.platform_fee_percentage, 2);
  winnings_pool := ROUND(total_pool - platform_fee, 2);
  
  -- Refund unused reserved base cost to creator
  reserved_base_cost := COALESCE(quiz_record.base_cost, quiz_record.entry_fee_per_question * quiz_record.total_questions * quiz_record.max_participants);
  remaining_base_refund := GREATEST(ROUND(reserved_base_cost - total_pool, 2), 0);
  
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
  
  -- Get total possible points
  SELECT COALESCE(SUM(points), 0) INTO total_possible_points
  FROM quiz_questions
  WHERE quiz_id = quiz_id_param;
  
  IF total_possible_points = 0 THEN
    SELECT COALESCE(SUM(points_earned), 0) INTO total_possible_points
    FROM quiz_responses
    WHERE quiz_id = quiz_id_param;
  END IF;
  
  -- Get settlement method (default to proportional)
  settlement_method := COALESCE(quiz_record.settlement_method, 'proportional');
  
  -- Distribute winnings based on settlement method
  IF settlement_method = 'proportional' THEN
    -- Proportional distribution based on score
    DECLARE
      total_score_sum NUMERIC;
      last_participant_id UUID;
      participant_record RECORD;
    BEGIN
      -- Calculate sum of all scores
      SELECT COALESCE(SUM(score), 0) INTO total_score_sum
      FROM quiz_participants
      WHERE quiz_id = quiz_id_param AND status = 'completed';
      
      IF total_score_sum > 0 THEN
        -- Distribute proportionally with proper rounding
        FOR participant_record IN
          SELECT * FROM quiz_participants
          WHERE quiz_id = quiz_id_param AND status = 'completed'
          ORDER BY score DESC, completed_at ASC
        LOOP
          -- Calculate proportional winnings
          user_winnings := ROUND((participant_record.score::NUMERIC / total_score_sum) * winnings_pool, 2);
          last_participant_id := participant_record.id;
          total_distributed := total_distributed + user_winnings;
          
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
        
        -- Handle rounding differences - add/subtract from last participant
        IF last_participant_id IS NOT NULL AND ABS(total_distributed - winnings_pool) > 0.01 THEN
          DECLARE
            rounding_diff NUMERIC;
          BEGIN
            rounding_diff := ROUND(winnings_pool - total_distributed, 2);
            IF ABS(rounding_diff) > 0 THEN
              -- Adjust last participant's winnings
              UPDATE quiz_participants
              SET winnings = winnings + rounding_diff
              WHERE id = last_participant_id;
              
              -- Adjust balance
              PERFORM increment_balance(
                (SELECT user_id FROM quiz_participants WHERE id = last_participant_id),
                rounding_diff
              );
            END IF;
          END;
        END IF;
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
      participant_record RECORD;
    BEGIN
      top_count := COALESCE(quiz_record.top_winners_count, 3);
      winners_pool := ROUND(winnings_pool / top_count, 2);
      
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
    DECLARE
      participant_record RECORD;
    BEGIN
      user_winnings := ROUND(winnings_pool / participants_count, 2);
      
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
    END;
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

