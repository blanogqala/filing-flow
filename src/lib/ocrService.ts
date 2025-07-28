import { supabase } from '@/integrations/supabase/client';

export interface OCRResult {
  date: string;
  merchant: string;
  category: string;
  amount: number;
  description: string;
  rawText: string;
}

// Real OCR processing using OCR.Space API
export const processReceiptOCR = async (file: File): Promise<OCRResult> => {
  try {
    // Convert file to base64
    const base64 = await fileToBase64(file);
    
    // Call OCR.Space API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apikey', 'K87899142388957'); // Free OCR.Space API key
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'false');
    formData.append('isTable', 'true');
    formData.append('scale', 'true');
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OCR API error: ${response.status}`);
    }
    
    const ocrResponse = await response.json();
    
    if (ocrResponse.ErrorMessage) {
      throw new Error(`OCR processing failed: ${ocrResponse.ErrorMessage}`);
    }
    
    const rawText = ocrResponse.ParsedResults?.[0]?.ParsedText || '';
    
    if (!rawText) {
      throw new Error('No text found in the receipt image');
    }
    
    // Parse the OCR text to extract receipt information
    const extractedData = parseReceiptText(rawText);
    
    return {
      ...extractedData,
      rawText
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    
    // Fallback to basic mock data if OCR fails
    return {
      date: new Date().toISOString().split('T')[0],
      merchant: 'Unknown Merchant',
      category: 'General',
      amount: 0.00,
      description: 'OCR processing failed - please edit manually',
      rawText: `OCR Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

// Helper function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
    };
    reader.onerror = reject;
  });
};

// Parse OCR text to extract receipt information
const parseReceiptText = (text: string): Omit<OCRResult, 'rawText'> => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Extract date
  const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/;
  const dateMatch = text.match(dateRegex);
  let date = new Date().toISOString().split('T')[0]; // Default to today
  
  if (dateMatch) {
    try {
      const parsedDate = new Date(dateMatch[0].replace(/[\.]/g, '/'));
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate.toISOString().split('T')[0];
      }
    } catch (e) {
      // Keep default date if parsing fails
    }
  }
  
  // Extract amounts (look for currency patterns)
  const amountRegex = /[\$£€¥₹]?\s*(\d+[,.]?\d*\.?\d{2})|(\d+[,.]?\d*\.?\d{2})\s*[\$£€¥₹]/g;
  const amounts: number[] = [];
  let match;
  
  while ((match = amountRegex.exec(text)) !== null) {
    const amountStr = match[1] || match[2];
    const amount = parseFloat(amountStr.replace(/[,$]/g, ''));
    if (!isNaN(amount) && amount > 0) {
      amounts.push(amount);
    }
  }
  
  // The largest amount is likely the total
  const amount = amounts.length > 0 ? Math.max(...amounts) : 0;
  
  // Extract merchant name (usually the first meaningful line)
  let merchant = 'Unknown Merchant';
  const potentialMerchants = lines.filter(line => 
    line.length > 3 && 
    !line.match(/^\d/) && 
    !line.toLowerCase().includes('receipt') &&
    !line.toLowerCase().includes('thank') &&
    !line.toLowerCase().includes('total') &&
    !line.match(/[\$£€¥₹]/) &&
    !line.match(dateRegex)
  );
  
  if (potentialMerchants.length > 0) {
    merchant = potentialMerchants[0];
  }
  
  // Determine category based on merchant name and text content
  const category = categorizeReceipt(text, merchant);
  
  // Generate description
  const description = `Purchase from ${merchant}`;
  
  return {
    date,
    merchant,
    category,
    amount: Math.round(amount * 100) / 100,
    description
  };
};

// Categorize receipt based on content
const categorizeReceipt = (text: string, merchant: string): string => {
  const lowerText = text.toLowerCase();
  const lowerMerchant = merchant.toLowerCase();
  
  if (lowerText.includes('grocery') || lowerText.includes('market') || 
      lowerText.includes('supermarket') || lowerMerchant.includes('market') ||
      lowerMerchant.includes('grocery') || lowerMerchant.includes('walmart') ||
      lowerMerchant.includes('target') || lowerMerchant.includes('costco')) {
    return 'Groceries';
  }
  
  if (lowerText.includes('gas') || lowerText.includes('fuel') || 
      lowerText.includes('petrol') || lowerMerchant.includes('shell') ||
      lowerMerchant.includes('bp') || lowerMerchant.includes('exxon') ||
      lowerMerchant.includes('chevron') || lowerMerchant.includes('mobil')) {
    return 'Transportation';
  }
  
  if (lowerText.includes('restaurant') || lowerText.includes('cafe') || 
      lowerText.includes('coffee') || lowerText.includes('pizza') ||
      lowerText.includes('burger') || lowerMerchant.includes('restaurant') ||
      lowerMerchant.includes('cafe') || lowerMerchant.includes('mcdonald') ||
      lowerMerchant.includes('starbucks') || lowerMerchant.includes('subway')) {
    return 'Dining';
  }
  
  if (lowerText.includes('pharmacy') || lowerText.includes('medical') || 
      lowerText.includes('hospital') || lowerMerchant.includes('pharmacy') ||
      lowerMerchant.includes('cvs') || lowerMerchant.includes('walgreens')) {
    return 'Healthcare';
  }
  
  if (lowerText.includes('clothing') || lowerText.includes('fashion') || 
      lowerMerchant.includes('clothing') || lowerMerchant.includes('fashion') ||
      lowerMerchant.includes('nike') || lowerMerchant.includes('adidas') ||
      lowerMerchant.includes('h&m') || lowerMerchant.includes('zara')) {
    return 'Clothing';
  }
  
  return 'General';
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