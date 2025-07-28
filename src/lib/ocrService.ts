import { supabase } from '@/integrations/supabase/client';

export interface OCRResult {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  description: string;
  rawText: string;
}

// Mock OCR processing - in a real app, you'd integrate with OCR.Space API
export const processReceiptOCR = async (file: File): Promise<OCRResult> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock extracted data based on filename for demo
  const fileName = file.name.toLowerCase();
  let mockData: OCRResult;
  
  if (fileName.includes('grocery') || fileName.includes('food')) {
    mockData = {
      date: new Date().toISOString().split('T')[0],
      merchant: 'Fresh Market',
      category: 'Groceries',
      amount: 45.67 + Math.random() * 20,
      description: 'Grocery shopping',
      rawText: 'Fresh Market\nTotal: $45.67\nDate: ' + new Date().toLocaleDateString()
    };
  } else if (fileName.includes('gas') || fileName.includes('fuel')) {
    mockData = {
      date: new Date().toISOString().split('T')[0],
      merchant: 'Shell Gas Station',
      category: 'Transportation',
      amount: 55.23 + Math.random() * 15,
      description: 'Fuel purchase',
      rawText: 'Shell\nFuel: $55.23\nDate: ' + new Date().toLocaleDateString()
    };
  } else if (fileName.includes('restaurant') || fileName.includes('dining')) {
    mockData = {
      date: new Date().toISOString().split('T')[0],
      merchant: 'The Garden Restaurant',
      category: 'Dining',
      amount: 28.95 + Math.random() * 25,
      description: 'Restaurant meal',
      rawText: 'The Garden Restaurant\nTotal: $28.95\nDate: ' + new Date().toLocaleDateString()
    };
  } else {
    mockData = {
      date: new Date().toISOString().split('T')[0],
      merchant: 'General Store',
      category: 'General',
      amount: 15.50 + Math.random() * 30,
      description: 'Purchase',
      rawText: 'Receipt\nTotal: $15.50\nDate: ' + new Date().toLocaleDateString()
    };
  }
  
  return {
    ...mockData,
    amount: Math.round(mockData.amount * 100) / 100 // Round to 2 decimals
  };
};

export const saveReceiptToSupabase = async (
  firebaseUid: string,
  fileName: string,
  fileUrl: string,
  ocrResult: OCRResult
) => {
  // First get or create the user in our users table
  const { data: userData, error: userError } = await supabase
    .rpc('get_or_create_user', { p_firebase_uid: firebaseUid });

  if (userError) {
    throw new Error(`Failed to get/create user: ${userError.message}`);
  }

  const { data, error } = await supabase
    .from('receipts')
    .insert({
      user_id: userData,
      file_name: fileName,
      file_url: fileUrl,
      date: ocrResult.date,
      merchant: ocrResult.merchant,
      category: ocrResult.category,
      amount: ocrResult.amount,
      description: ocrResult.description,
      ocr_text: ocrResult.rawText
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save receipt: ${error.message}`);
  }

  return data;
};

export const getUserReceipts = async (firebaseUid: string) => {
  // Use the database function that properly handles Firebase UIDs
  const { data, error } = await supabase
    .rpc('get_user_receipts', { p_firebase_uid: firebaseUid });

  if (error) {
    throw new Error(`Failed to fetch receipts: ${error.message}`);
  }

  return data;
};

export const updateReceipt = async (receiptId: string, updates: Partial<OCRResult>) => {
  const { data, error } = await supabase
    .from('receipts')
    .update(updates)
    .eq('id', receiptId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update receipt: ${error.message}`);
  }

  return data;
};

export const deleteReceipt = async (receiptId: string) => {
  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', receiptId);

  if (error) {
    throw new Error(`Failed to delete receipt: ${error.message}`);
  }
};