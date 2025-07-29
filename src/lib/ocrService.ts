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
  console.log(`🔍 Starting OCR processing for file: ${file.name}`);
  
  try {
    // Call OCR.Space API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apikey', 'K87899142388957'); // Free OCR.Space API key
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('isTable', 'false');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
    
    console.log('📤 Sending OCR request to OCR.Space API...');
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      console.error(`❌ OCR API error: ${response.status}`);
      throw new Error(`OCR API error: ${response.status}`);
    }
    
    const ocrResponse = await response.json();
    console.log('📥 OCR API Response:', ocrResponse);
    
    if (ocrResponse.ErrorMessage && ocrResponse.ErrorMessage.length > 0) {
      console.error('❌ OCR Error Messages:', ocrResponse.ErrorMessage);
      throw new Error(`OCR processing failed: ${ocrResponse.ErrorMessage.join(', ')}`);
    }
    
    const rawText = ocrResponse.ParsedResults?.[0]?.ParsedText || '';
    console.log('📄 Raw OCR Text:', rawText);
    
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('No text found in the receipt image');
    }
    
    // Parse the OCR text to extract receipt information
    const extractedData = parseReceiptText(rawText);
    console.log('✅ Extracted Data:', extractedData);
    
    return {
      ...extractedData,
      rawText
    };
  } catch (error) {
    console.error('❌ OCR processing error:', error);
    
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

// Parse OCR text to extract receipt information with enhanced accuracy
const parseReceiptText = (text: string): Omit<OCRResult, 'rawText'> => {
  console.log('🔧 Parsing receipt text...');
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  console.log('📋 Text lines:', lines);
  
  // Enhanced date extraction with multiple patterns
  const datePatterns = [
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/g,  // MM/DD/YYYY or DD/MM/YYYY
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,  // YYYY/MM/DD
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2})/g,  // MM/DD/YY or DD/MM/YY
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi, // Month DD, YYYY
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/gi // DD Month YYYY
  ];
  
  let date = new Date().toISOString().split('T')[0]; // Default to today
  let foundDate = false;
  
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        try {
          const parsedDate = new Date(match.replace(/[\.]/g, '/'));
          if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900 && parsedDate.getFullYear() < 2030) {
            date = parsedDate.toISOString().split('T')[0];
            foundDate = true;
            console.log(`📅 Found date: ${match} -> ${date}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      if (foundDate) break;
    }
  }
  
  // Enhanced amount extraction with multiple currency patterns
  const amountPatterns = [
    /(?:total|amount|sum)[:\s]*[\$£€¥₹]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /[\$£€¥₹]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[\$£€¥₹]/g,
    /(\d+\.\d{2})(?!\d)/g // Any decimal number with 2 places
  ];
  
  const amounts: number[] = [];
  
  for (const pattern of amountPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1].replace(/[,$]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0 && amount < 100000) { // Reasonable limits
        amounts.push(amount);
        console.log(`💰 Found amount: ${match[0]} -> ${amount}`);
      }
    }
  }
  
  // Get the largest amount (likely the total) or look for "total" keyword nearby
  let amount = 0;
  if (amounts.length > 0) {
    // Look for amounts near "total" keywords first
    const totalRegex = /(?:total|amount|sum)[:\s]*[\$£€¥₹]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi;
    let totalMatch = totalRegex.exec(text);
    if (totalMatch) {
      const totalAmount = parseFloat(totalMatch[1].replace(/[,$]/g, ''));
      if (!isNaN(totalAmount)) {
        amount = totalAmount;
        console.log(`🎯 Found total amount: ${totalAmount}`);
      }
    } else {
      // Fallback to largest amount
      amount = Math.max(...amounts);
      console.log(`📊 Using largest amount: ${amount}`);
    }
  }
  
  // Enhanced merchant name extraction
  let merchant = 'Unknown Merchant';
  
  // Look for business names in first few lines (skip address info)
  const businessPatterns = [
    // Lines that look like business names (uppercase, mixed case with capitals)
    /^[A-Z][A-Za-z\s&.''-]{2,40}$/,
    // Lines with common business suffixes
    /^.+(?:LLC|Inc|Corp|Co\.|Company|Restaurant|Store|Market|Shop).*$/i,
    // Lines that are likely merchant names (not numbers, addresses, or receipts)
    /^[A-Za-z][A-Za-z\s&.''-]{3,30}$/
  ];
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    
    // Skip lines that are clearly not merchant names
    if (line.match(/^\d/) || 
        line.toLowerCase().includes('receipt') ||
        line.toLowerCase().includes('thank') ||
        line.toLowerCase().includes('address') ||
        line.toLowerCase().includes('phone') ||
        line.toLowerCase().includes('www') ||
        line.includes('@') ||
        line.match(/[\$£€¥₹]/) ||
        line.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d/)) {
      continue;
    }
    
    // Check if line matches business patterns
    for (const pattern of businessPatterns) {
      if (pattern.test(line)) {
        merchant = line.length > 50 ? line.substring(0, 50) : line;
        console.log(`🏪 Found merchant: ${merchant}`);
        break;
      }
    }
    
    if (merchant !== 'Unknown Merchant') break;
  }
  
  // If still no merchant found, use first non-numeric line
  if (merchant === 'Unknown Merchant') {
    const fallbackMerchant = lines.find(line => 
      line.length > 2 && 
      line.length < 50 &&
      !line.match(/^\d/) &&
      !line.includes('@') &&
      !line.match(/[\$£€¥₹]/)
    );
    if (fallbackMerchant) {
      merchant = fallbackMerchant;
      console.log(`🏪 Fallback merchant: ${merchant}`);
    }
  }
  
  // Determine category based on merchant name and text content
  const category = categorizeReceipt(text, merchant);
  
  // Generate more descriptive description
  let description = `Purchase from ${merchant}`;
  if (amount > 0) {
    description += ` - $${amount.toFixed(2)}`;
  }
  if (foundDate && date !== new Date().toISOString().split('T')[0]) {
    description += ` on ${date}`;
  }
  
  console.log(`📄 Final parsed data:`, {
    date,
    merchant,
    category,
    amount: Math.round(amount * 100) / 100,
    description
  });
  
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