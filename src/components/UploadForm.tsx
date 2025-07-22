import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileImage, FileText, X, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface UploadFormProps {
  onFileUpload: (files: File[]) => void;
  uploadedFiles: File[];
  onRemoveFile: (index: number) => void;
}

export const UploadForm = ({ onFileUpload, uploadedFiles, onRemoveFile }: UploadFormProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      const isValid = file.type.startsWith('image/') || file.type === 'application/pdf';
      if (!isValid) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a valid image or PDF file`,
          variant: "destructive",
        });
      }
      return isValid;
    });
    
    if (validFiles.length > 0) {
      onFileUpload(validFiles);
      toast({
        title: "Files uploaded successfully",
        description: `${validFiles.length} file(s) uploaded`,
      });
    }
  }, [onFileUpload, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      'application/pdf': ['.pdf']
    },
    multiple: true,
    onDragEnter: () => setIsHovering(true),
    onDragLeave: () => setIsHovering(false),
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-6 w-6 text-primary" />;
    }
    return <FileText className="h-6 w-6 text-primary" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <Card className="bg-card border border-border/50 shadow-accent">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300
              ${isDragActive || isHovering 
                ? 'border-primary bg-gradient-accent animate-pulse-glow' 
                : 'border-border hover:border-primary/50 hover:bg-gradient-accent/50'
              }
            `}
          >
            <input {...getInputProps()} />
            
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: isDragActive ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <Upload className={`h-12 w-12 mx-auto ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {isDragActive ? 'Drop your receipts here!' : 'Upload Receipt Files'}
                </h3>
                <p className="text-muted-foreground">
                  Drag & drop images or PDFs, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports: JPG, PNG, GIF, BMP, WebP, PDF
                </p>
              </div>
              
              <Button 
                variant="outline" 
                className="mt-4 border-primary/50 hover:bg-primary hover:text-primary-foreground"
              >
                Choose Files
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-card border border-border/50">
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 text-accent mr-2" />
                  Uploaded Files ({uploadedFiles.length})
                </h4>
                
                <div className="space-y-3">
                  {uploadedFiles.map((file, index) => (
                    <motion.div
                      key={`${file.name}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveFile(index)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};