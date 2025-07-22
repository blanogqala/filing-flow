import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileImage, FileText, ZoomIn, ZoomOut, RotateCw, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ReceiptPreviewProps {
  files: File[];
  onProcessFiles: () => void;
  isProcessing: boolean;
}

export const ReceiptPreview = ({ files, onProcessFiles, isProcessing }: ReceiptPreviewProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (files.length === 0) return null;

  const getFileUrl = (file: File) => URL.createObjectURL(file);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6"
    >
      <Card className="bg-card border border-border/50 shadow-accent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-primary" />
              <span>Receipt Preview</span>
            </CardTitle>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              {files.length} file{files.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="relative group"
              >
                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-primary transition-all duration-300 group-hover:scale-105 bg-secondary/50">
                      <CardContent className="p-3">
                        {file.type.startsWith('image/') ? (
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                            <img
                              src={getFileUrl(file)}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {getFileIcon(file.type)}
                              <span className="ml-1">
                                {file.type.startsWith('image/') ? 'Image' : 'PDF'}
                              </span>
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        {getFileIcon(file.type)}
                        <span>{file.name}</span>
                      </DialogTitle>
                      
                      {file.type.startsWith('image/') && (
                        <div className="flex items-center space-x-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRotation((rotation + 90) % 360)}
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          <Badge variant="secondary">
                            {Math.round(zoom * 100)}%
                          </Badge>
                        </div>
                      )}
                    </DialogHeader>
                    
                    <div className="relative overflow-auto max-h-[70vh] bg-muted/50 rounded-lg">
                      {file.type.startsWith('image/') ? (
                        <div className="flex items-center justify-center p-4">
                          <img
                            src={getFileUrl(file)}
                            alt={file.name}
                            style={{
                              transform: `scale(${zoom}) rotate(${rotation}deg)`,
                              transition: 'transform 0.2s ease',
                            }}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center space-y-4">
                            <FileText className="h-24 w-24 text-muted-foreground mx-auto" />
                            <div>
                              <p className="text-lg font-medium">PDF Preview</p>
                              <p className="text-muted-foreground">
                                PDF preview is not available in this view
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            ))}
          </div>

          {/* Process Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="pt-4"
          >
            <Button
              onClick={onProcessFiles}
              disabled={isProcessing}
              className="w-full bg-gradient-primary hover:shadow-primary text-primary-foreground"
              size="lg"
            >
              {isProcessing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <RotateCw className="h-4 w-4" />
                </motion.div>
              ) : null}
              {isProcessing ? 'Processing Receipts...' : 'Extract Data from Receipts'}
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};