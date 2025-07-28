import { supabase } from '@/integrations/supabase/client';

export const uploadFileToSupabase = async (file: File, userId: string): Promise<string> => {
  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${file.name}`;
    
    // Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(filename, file);
    
    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(filename);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file to Supabase Storage');
  }
};

export const uploadMultipleFiles = async (files: File[], userId: string): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadFileToSupabase(file, userId));
    const downloadURLs = await Promise.all(uploadPromises);
    return downloadURLs;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw new Error('Failed to upload files to Supabase Storage');
  }
};