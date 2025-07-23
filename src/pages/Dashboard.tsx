import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { uploadMultipleFiles } from '@/lib/uploadToFirebase';
import { processReceiptOCR, saveReceiptToSupabase, getUserReceipts } from '@/lib/ocrService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadForm } from '@/components/UploadForm';
import { ReceiptPreview } from '@/components/ReceiptPreview';
import { ReceiptTable, ReceiptData } from '@/components/ReceiptTable';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { ExcelEditor, ExcelRowData } from '@/components/ExcelEditor';
import { FileText, LogOut, User, Sparkles, Zap, Shield, Clock } from 'lucide-react';

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ReceiptData[]>([]);
  const [excelData, setExcelData] = useState<ExcelRowData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Load user's receipts on component mount
  useEffect(() => {
    const loadUserReceipts = async () => {
      try {
        const receipts = await getUserReceipts(user.uid);
        const excelRows: ExcelRowData[] = receipts.map(receipt => ({
          id: receipt.id,
          date: receipt.date,
          merchant: receipt.merchant,
          category: receipt.category,
          amount: parseFloat(receipt.amount.toString()),
          description: receipt.description || '',
          fileName: receipt.file_name
        }));
        setExcelData(excelRows);
      } catch (error: any) {
        console.error('Error loading receipts:', error);
      }
    };

    if (user?.uid) {
      loadUserReceipts();
    }
  }, [user?.uid]);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      // Upload files to Firebase Storage
      const uploadedUrls = await uploadMultipleFiles(files, user.uid);
      
      // Update state with both files and URLs
      setUploadedFiles(prev => [...prev, ...files]);
      setUploadedUrls(prev => [...prev, ...uploadedUrls]);
      
      toast({
        title: "Files uploaded successfully!",
        description: `${files.length} file(s) uploaded to secure storage`,
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const processReceipts = async () => {
    setIsProcessing(true);
    
    try {
      // Process each uploaded file with OCR
      const processedReceipts = [];
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const fileUrl = uploadedUrls[i];
        
        // Process with OCR
        const ocrResult = await processReceiptOCR(file);
        
        // Save to Supabase
        const savedReceipt = await saveReceiptToSupabase(
          user.uid,
          file.name,
          fileUrl,
          ocrResult
        );
        
        processedReceipts.push(savedReceipt);
        
        // Add to Excel data
        const excelRow: ExcelRowData = {
          id: savedReceipt.id,
          date: savedReceipt.date,
          merchant: savedReceipt.merchant,
          category: savedReceipt.category,
          amount: parseFloat(savedReceipt.amount.toString()),
          description: savedReceipt.description || '',
          fileName: savedReceipt.file_name
        };
        
        setExcelData(prev => [...prev, excelRow]);
      }
      
      // Clear uploaded files after processing
      setUploadedFiles([]);
      setUploadedUrls([]);
      
      toast({
        title: "Receipts processed successfully!",
        description: `Extracted data from ${processedReceipts.length} receipts and saved to your Excel sheet`,
      });
    } catch (error: any) {
      toast({
        title: "Error processing receipts",
        description: error.message || "Failed to process receipts",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelDataChange = (newData: ExcelRowData[]) => {
    setExcelData(newData);
    // You could also auto-save changes to Supabase here if needed
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  E-Filing Assistant
                </h1>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Pro Version
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{user?.email}</span>
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-gradient-accent border border-border/50 shadow-glow">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <span>Welcome to Your Digital Filing Assistant</span>
              </CardTitle>
              <CardDescription className="text-base">
                Transform your receipt management with AI-powered OCR technology. 
                Upload, extract, organize, and export your financial data effortlessly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-primary/5 rounded-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Lightning Fast</p>
                    <p className="text-sm text-muted-foreground">OCR processing in seconds</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-accent/5 rounded-lg">
                  <Shield className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Secure & Private</p>
                    <p className="text-sm text-muted-foreground">Your data stays protected</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-secondary/5 rounded-lg">
                  <Clock className="h-5 w-5 text-foreground" />
                  <div>
                    <p className="font-medium">Save Time</p>
                    <p className="text-sm text-muted-foreground">Automated data extraction</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Section */}
        <UploadForm
          onFileUpload={handleFileUpload}
          uploadedFiles={uploadedFiles}
          onRemoveFile={handleRemoveFile}
          isUploading={isUploading}
        />

        {/* Preview Section */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <ReceiptPreview
              files={uploadedFiles}
              onProcessFiles={processReceipts}
              isProcessing={isProcessing}
            />
          )}
        </AnimatePresence>

        {/* Excel Editor - Main Interface */}
        <AnimatePresence>
          {(excelData.length > 0 || uploadedFiles.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <ExcelEditor 
                initialData={excelData} 
                onDataChange={handleExcelDataChange}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {uploadedFiles.length === 0 && excelData.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center py-16"
          >
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ready to Get Started?</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload your first receipt to see the magic happen. Our AI will extract all the important 
              information and organize it into your Excel spreadsheet automatically.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};