/*
  # Add Profile Validations and Convert Stage to Enum

  ## Changes
  1. Drop existing stage check constraint
  2. Create enum type for business stages
  3. Migrate existing stage data to enum values
  4. Convert stage column to use enum type
  5. Add email format validation
  6. Add phone number format validation
  7. Make stage a required field

  ## Enum Values
  - idea: Just exploring a business idea
  - validation: Validating market fit
  - mvp: Building minimum viable product
  - launch: Launching to market
  - growth: Scaling the business
  - established: Running profitable business
  - exit: Planning exit strategy

  ## Data Migration
  - 'ideation' → 'idea'
  - 'building' → 'mvp'
  - 'launched' → 'launch'
  - 'scaling' → 'growth'
*/

-- Drop existing check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_stage_check;

-- Create enum type for business stages
DO $$ BEGIN
  CREATE TYPE business_stage AS ENUM (
    'idea',
    'validation',
    'mvp',
    'launch',
    'growth',
    'established',
    'exit'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Migrate existing data to match enum values
UPDATE profiles
SET stage = CASE
  WHEN stage = 'ideation' THEN 'idea'
  WHEN stage = 'building' THEN 'mvp'
  WHEN stage = 'launched' THEN 'launch'
  WHEN stage = 'scaling' THEN 'growth'
  WHEN stage = 'idea' THEN 'idea'
  WHEN stage = 'validation' THEN 'validation'
  WHEN stage = 'mvp' THEN 'mvp'
  WHEN stage = 'launch' THEN 'launch'
  WHEN stage = 'growth' THEN 'growth'
  WHEN stage = 'established' THEN 'established'
  WHEN stage = 'exit' THEN 'exit'
  ELSE 'idea'
END
WHERE stage IS NOT NULL;

-- Set default stage for profiles without one
UPDATE profiles
SET stage = 'idea'
WHERE stage IS NULL;

-- Convert stage column to enum type
ALTER TABLE profiles
  ALTER COLUMN stage TYPE business_stage USING stage::business_stage;

-- Make stage required
ALTER TABLE profiles
  ALTER COLUMN stage SET NOT NULL;

-- Set default value for new profiles
ALTER TABLE profiles
  ALTER COLUMN stage SET DEFAULT 'idea';

-- Add email format validation (supports French accented characters)
ALTER TABLE profiles
  ADD CONSTRAINT valid_email_format
  CHECK (
    email IS NULL OR
    email ~* '^[A-Za-z0-9._+\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  );

-- Add phone number validation
-- Accepts digits only (formatting will be handled in application)
-- 7-15 digits for international numbers
ALTER TABLE profiles
  ADD CONSTRAINT valid_phone_format
  CHECK (
    phone_number IS NULL OR
    phone_number ~ '^\+?[0-9]{7,15}$'
  );

-- Create index on stage for filtering and analytics
CREATE INDEX IF NOT EXISTS idx_profiles_stage ON profiles(stage);

-- Add helpful comments
COMMENT ON COLUMN profiles.stage IS 'Current business stage: idea, validation, mvp, launch, growth, established, exit';
COMMENT ON COLUMN profiles.email IS 'User email address with format validation (supports accented characters)';
COMMENT ON COLUMN profiles.phone_number IS 'Phone number (7-15 digits, optional + prefix, stored without formatting)';