-- Update user_id column to TEXT to support Firebase user IDs
ALTER TABLE public.receipts 
ALTER COLUMN user_id TYPE TEXT;