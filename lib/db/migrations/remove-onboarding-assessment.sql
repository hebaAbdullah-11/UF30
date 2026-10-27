-- Removes the diagnostic self-assessment from onboarding. Onboarding now runs
-- intro -> chat -> complete; the scored ADHD-subtype result is no longer stored.
UPDATE user_onboarding SET stage = 'chat' WHERE stage IN ('assessment', 'result');
ALTER TABLE user_onboarding
  DROP COLUMN IF EXISTS assessment_step,
  DROP COLUMN IF EXISTS assessment_answers,
  DROP COLUMN IF EXISTS assessment_result;
