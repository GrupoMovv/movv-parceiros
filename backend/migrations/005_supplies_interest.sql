-- Adiciona 'supplies' como valor valido no campo service de interest_submissions
-- Execute: psql $DATABASE_URL -f migrations/005_supplies_interest.sql

ALTER TABLE interest_submissions
  DROP CONSTRAINT IF EXISTS interest_submissions_service_check;

ALTER TABLE interest_submissions
  ADD CONSTRAINT interest_submissions_service_check
  CHECK (service IN ('office', 'collections', 'supplies'));
