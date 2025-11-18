-- Update wager sharing to use simple link-based sharing
-- Private wagers are accessible via direct link (anyone with the link can view)
-- Public wagers appear on the wagers page, private wagers do not

-- Update wagers RLS policy to allow direct link access to private wagers
DROP POLICY IF EXISTS "public read wagers" ON wagers;
CREATE POLICY "public read wagers" ON wagers 
  FOR SELECT 
  USING (
    is_public = true 
    OR auth.uid() = creator_id
    OR true  -- Allow direct link access to private wagers (anyone with the link can view)
  );

