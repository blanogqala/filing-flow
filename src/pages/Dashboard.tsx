import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { uploadMultipleFiles } from '@/lib/uploadToFirebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadForm } from '@/components/UploadForm';
import { ReceiptPreview } from '@/components/ReceiptPreview';
import { ReceiptTable, ReceiptData } from '@/components/ReceiptTable';
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton';
import { FileText, LogOut, User, Sparkles, Zap, Shield, Clock } from 'lucide-react';

interface DashboardProps {
  user: any;
}

export const Dashboard = ({ user }: DashboardProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [extractedData, setExtractedData] = useState<ReceiptData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

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

  const mockOCRProcessing = async () => {
    setIsProcessing(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate mock data for demonstration
    const mockData: ReceiptData[] = uploadedFiles.map((file, index) => ({
      id: `receipt-${Date.now()}-${index}`,
      fileName: file.name,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      merchant: ['Walmart', 'Target', 'Amazon', 'Costco', 'Home Depot', 'Best Buy'][Math.floor(Math.random() * 6)],
      total: Math.round((Math.random() * 200 + 10) * 100) / 100,
      category: ['Groceries', 'Electronics', 'Office Supplies', 'Home & Garden', 'Clothing'][Math.floor(Math.random() * 5)],
      items: [
        { name: 'Item 1', quantity: 1, price: Math.round(Math.random() * 50 * 100) / 100 },
        { name: 'Item 2', quantity: 2, price: Math.round(Math.random() * 30 * 100) / 100 },
      ]
    }));
    
    setExtractedData(prev => [...prev, ...mockData]);
    setIsProcessing(false);
    
    toast({
      title: "Receipts processed successfully!",
      description: `Extracted data from ${uploadedFiles.length} receipts`,
    });
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
              onProcessFiles={mockOCRProcessing}
              isProcessing={isProcessing}
            />
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {(extractedData.length > 0 || isProcessing) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <ReceiptTable data={extractedData} isLoading={isProcessing} />
              
              {extractedData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="flex justify-center"
                >
                  <ExcelDownloadButton data={extractedData} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {uploadedFiles.length === 0 && extractedData.length === 0 && (
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
              information and organize it for you automatically.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
};