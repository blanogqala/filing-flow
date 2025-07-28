-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;

-- Create more permissive policies for receipts bucket since we're using Firebase auth
CREATE POLICY "Allow all operations on receipts bucket" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'receipts');

-- Make the bucket publicly accessible for reads
CREATE POLICY "Public read access for receipts" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts');