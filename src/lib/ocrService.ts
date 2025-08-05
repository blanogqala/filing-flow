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
    // Balance Due patterns (highest priority) - handle both commas and spaces as thousands separators
    /Balance\s+Due[:\s]*R?\s*(\d{1,3}(?:[,\s]\d{3})*(?:[,\.]?\d{2})?)/gi,
    // Total patterns with currency symbols - but lower priority than Balance Due
    /(?:total|amount|sum)[:\s]*R?\s*(\d{1,3}(?:[,\s]\d{3})*(?:[,\.]?\d{2})?)/gi,
    // Currency symbol patterns - South African Rand with exact matching
    /R\s*(\d{1,3}(?:[,\s]\d{3})*(?:[,\.]?\d{2})?)/g,
    // Invoice total patterns
    /invoice\s+total[:\s]*R?\s*(\d{1,3}(?:[,\s]\d{3})*(?:[,\.]?\d{2})?)/gi,
    // Large amounts (6+ digits, likely totals)
    /(?<!\d)(\d{6,}(?:[,\s]\d{3})*(?:[,\.]?\d{2})?)(?!\d)/g
  ];
  
  const amounts: { value: number; context: string; priority: number }[] = [];
  
  for (let i = 0; i < amountPatterns.length; i++) {
    const pattern = amountPatterns[i];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Clean the amount string - handle both comma and period as decimal separators
      let amountStr = match[1].replace(/[R\$£€¥₹]/g, '').trim();
      
      // Handle South African number format (comma as thousands separator, period as decimal)
      // First check if it's a large number with commas (like 218,040)
      if (amountStr.includes(',') && !amountStr.includes('.')) {
        // If comma appears and no period, treat comma as thousands separator
        amountStr = amountStr.replace(/,/g, '');
      } else if (amountStr.includes(',') && amountStr.includes('.')) {
        // Both comma and period - comma is thousands, period is decimal
        const parts = amountStr.split('.');
        const beforeDecimal = parts[0].replace(/,/g, '');
        amountStr = beforeDecimal + '.' + parts[1];
      }
      
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount) && amount > 0 && amount < 100000000) {
        const priority = i === 0 ? 10 : // Balance Due gets highest priority
                       i === 1 ? 8 : // Total/Amount patterns get high priority
                       i === 2 ? 7 : // R currency patterns get medium-high priority
                       i === 3 ? 6 : // Invoice total patterns
                       amount > 100000 ? 5 : // Very large amounts (100k+)
                       amount > 50000 ? 4 : // Large amounts (50k+)
                       amount > 10000 ? 3 : // Medium amounts (10k+)
                       1; // Small amounts get lowest priority
        
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

// Generate intelligent description based on content analysis
const generateDescription = (text: string, merchant: string, amount: number, date: string, foundDate: boolean): string => {
  const lowerText = text.toLowerCase();
  
  // Extract itemized content for intelligent categorization
  const items = extractItemsFromText(text);
  let description = '';
  
  // Intelligent categorization based on found items with better summaries
  if (items.building.length > 0) {
    if (items.building.some(item => ['paint', 'brush', 'roller'].includes(item))) {
      description = `Painting materials (${items.building.slice(0, 4).join(', ')}${items.building.length > 4 ? ' and more' : ''})`;
    } else if (items.building.some(item => ['cement', 'concrete', 'brick'].includes(item))) {
      description = `Construction materials (${items.building.slice(0, 4).join(', ')}${items.building.length > 4 ? ' and more' : ''})`;
    } else {
      description = `Building materials (${items.building.slice(0, 4).join(', ')}${items.building.length > 4 ? ' and more' : ''})`;
    }
  } else if (items.medical.length > 0) {
    description = `Pills and medication (${items.medical.slice(0, 4).join(', ')}${items.medical.length > 4 ? ' and more' : ''})`;
  } else if (items.automotive.length > 0) {
    description = `Automotive parts (${items.automotive.slice(0, 4).join(', ')}${items.automotive.length > 4 ? ' and more' : ''})`;
  } else if (items.food.length > 0) {
    description = `Food and groceries (${items.food.slice(0, 4).join(', ')}${items.food.length > 4 ? ' and more' : ''})`;
  } else if (items.office.length > 0) {
    description = `Office supplies (${items.office.slice(0, 4).join(', ')}${items.office.length > 4 ? ' and more' : ''})`;
  } else {
    // Enhanced context-based descriptions for specific receipt types
    if (lowerText.includes('truck') || lowerText.includes('vehicle') || lowerText.includes('isuzu') || lowerText.includes('auction')) {
      // Extract vehicle details more precisely
      const vehicleDescMatch = text.match(/(\d{4}[\s]*(?:ISUZU|TOYOTA|FORD|BMW|MERCEDES|TRUCK)[\s\w\/\-]*)/gi);
      if (vehicleDescMatch) {
        description = `Vehicle purchase: ${vehicleDescMatch[0].trim().replace(/\s+/g, ' ')}`;
      } else {
        description = 'Vehicle purchase at auction';
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
      description = `Purchase from ${merchant}`;
    }
  }
  
  return description;
};

// Extract and categorize items from receipt text
const extractItemsFromText = (text: string) => {
  const lowerText = text.toLowerCase();
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const items = {
    building: [] as string[],
    medical: [] as string[],
    automotive: [] as string[],
    food: [] as string[],
    office: [] as string[]
  };
  
  // Building materials keywords
  const buildingKeywords = [
    'paint', 'brush', 'roller', 'cement', 'concrete', 'brick', 'tile', 'wood', 'lumber', 
    'nail', 'screw', 'hammer', 'drill', 'saw', 'pipe', 'wire', 'electrical', 'plumbing',
    'insulation', 'drywall', 'sheetrock', 'roofing', 'shingle', 'siding', 'door', 'window',
    'cabinet', 'flooring', 'carpet', 'laminate', 'hardwood', 'vinyl', 'grout', 'adhesive'
  ];
  
  // Medical keywords
  const medicalKeywords = [
    'pill', 'tablet', 'capsule', 'medicine', 'medication', 'prescription', 'antibiotic',
    'painkiller', 'vitamin', 'supplement', 'syrup', 'drops', 'cream', 'ointment', 'bandage',
    'gauze', 'thermometer', 'syringe', 'ibuprofen', 'acetaminophen', 'aspirin', 'pharmacy'
  ];
  
  // Automotive keywords
  const automotiveKeywords = [
    'oil', 'filter', 'brake', 'tire', 'battery', 'spark plug', 'belt', 'hose', 'fluid',
    'transmission', 'engine', 'radiator', 'alternator', 'starter', 'muffler', 'exhaust',
    'windshield', 'headlight', 'taillight', 'bumper', 'fender', 'mirror', 'wiper'
  ];
  
  // Food keywords
  const foodKeywords = [
    'bread', 'milk', 'egg', 'cheese', 'butter', 'meat', 'chicken', 'beef', 'pork', 'fish',
    'vegetable', 'fruit', 'apple', 'banana', 'orange', 'carrot', 'potato', 'onion', 'garlic',
    'rice', 'pasta', 'cereal', 'sugar', 'flour', 'salt', 'pepper', 'spice', 'sauce', 'juice'
  ];
  
  // Office supplies keywords
  const officeKeywords = [
    'paper', 'pen', 'pencil', 'marker', 'highlighter', 'stapler', 'clips', 'folder', 'binder',
    'notebook', 'envelope', 'stamp', 'tape', 'glue', 'scissors', 'ruler', 'calculator',
    'printer', 'ink', 'toner', 'cartridge', 'computer', 'keyboard', 'mouse', 'monitor'
  ];
  
  // Search through lines for items
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    buildingKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && !items.building.includes(keyword)) {
        items.building.push(keyword);
      }
    });
    
    medicalKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && !items.medical.includes(keyword)) {
        items.medical.push(keyword);
      }
    });
    
    automotiveKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && !items.automotive.includes(keyword)) {
        items.automotive.push(keyword);
      }
    });
    
    foodKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && !items.food.includes(keyword)) {
        items.food.push(keyword);
      }
    });
    
    officeKeywords.forEach(keyword => {
      if (lowerLine.includes(keyword) && !items.office.includes(keyword)) {
        items.office.push(keyword);
      }
    });
  });
  
  return items;
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