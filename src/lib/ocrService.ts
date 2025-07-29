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
    /Date\s+Issued\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi, // "Date Issued : DD/MM/YYYY"
    /Date\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi, // "Date : DD/MM/YYYY"
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
          // Extract just the date part if it's a labeled date
          let dateStr = match;
          if (match.toLowerCase().includes('date')) {
            const dateMatch = match.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/);
            if (dateMatch) dateStr = dateMatch[1];
          }
          
          const parsedDate = new Date(dateStr.replace(/[\.]/g, '/'));
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
  
  // Enhanced amount extraction with multiple currency patterns including South African Rand
  const amountPatterns = [
    // Balance Due patterns (highest priority)
    /Balance\s+Due[:\s]*R?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    // Total patterns with currency symbols
    /(?:total|amount|sum|due)[:\s]*[R\$£€¥₹]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    // Currency symbol patterns
    /[R\$£€¥₹]\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[R\$£€¥₹]/g,
    // Large amounts (likely totals) - prioritize amounts over 1000
    /(\d{3,}(?:,\d{3})*(?:\.\d{2})?)/g
  ];
  
  const amounts: { value: number; context: string; priority: number }[] = [];
  
  for (let i = 0; i < amountPatterns.length; i++) {
    const pattern = amountPatterns[i];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1].replace(/[,$]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) { // Increased reasonable limits
        const priority = i === 0 ? 5 : // Balance Due gets highest priority
                       i <= 2 ? 4 : // Total/Amount patterns get high priority
                       amount > 10000 ? 3 : // Large amounts get medium priority
                       amount > 1000 ? 2 : 1; // Smaller amounts get lower priority
        
        amounts.push({ 
          value: amount, 
          context: match[0], 
          priority 
        });
        console.log(`💰 Found amount: ${match[0]} -> ${amount} (priority: ${priority})`);
      }
    }
  }
  
  // Sort by priority (highest first), then by amount (largest first)
  amounts.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.value - a.value;
  });
  
  let amount = 0;
  if (amounts.length > 0) {
    amount = amounts[0].value;
    console.log(`🎯 Selected amount: ${amounts[0].context} -> ${amount} (priority: ${amounts[0].priority})`);
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
  
  // Generate more descriptive description based on content
  let description = generateDescription(text, merchant, amount, date, foundDate);
  
  console.log(`📝 Generated description: ${description}`);
  
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

// Generate detailed description based on content
const generateDescription = (text: string, merchant: string, amount: number, date: string, foundDate: boolean): string => {
  const lowerText = text.toLowerCase();
  let description = '';
  
  // Look for specific items or services in the text
  if (lowerText.includes('truck') || lowerText.includes('vehicle') || lowerText.includes('car')) {
    const vehicleMatch = text.match(/([\d\s\w]+(?:truck|vehicle|car|isuzu|toyota|ford|bmw|mercedes)[\w\s]*)/gi);
    if (vehicleMatch) {
      description = `Vehicle purchase: ${vehicleMatch[0].trim()}`;
    } else {
      description = 'Vehicle purchase';
    }
  } else if (lowerText.includes('auction')) {
    description = 'Auction purchase';
    const lotMatch = text.match(/lot[\s:]*(\d+)/gi);
    if (lotMatch) {
      description += ` - ${lotMatch[0]}`;
    }
  } else if (lowerText.includes('invoice') || lowerText.includes('pro-forma')) {
    description = 'Invoice payment';
  } else {
    // Generic description
    description = `Purchase from ${merchant}`;
  }
  
  // Add amount if available
  if (amount > 0) {
    description += ` - R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  }
  
  // Add date if different from today
  if (foundDate && date !== new Date().toISOString().split('T')[0]) {
    description += ` on ${date}`;
  }
  
  return description;
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