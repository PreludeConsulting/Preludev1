-- Add PARENT to the user_role enum for parent/guardian accounts.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'PARENT';
