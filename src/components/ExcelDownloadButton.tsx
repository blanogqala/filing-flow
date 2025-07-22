import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReceiptData } from './ReceiptTable';

interface ExcelDownloadButtonProps {
  data: ReceiptData[];
  disabled?: boolean;
}

export const ExcelDownloadButton = ({ data, disabled = false }: ExcelDownloadButtonProps) => {
  const { toast } = useToast();

  const downloadExcel = () => {
    if (data.length === 0) {
      toast({
        title: "No data to export",
        description: "Please process some receipts first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare data for Excel
      const excelData = data.map(receipt => ({
        'File Name': receipt.fileName,
        'Date': new Date(receipt.date).toLocaleDateString(),
        'Merchant': receipt.merchant,
        'Category': receipt.category,
        'Total Amount': receipt.total,
        'Items Count': receipt.items?.length || 0,
      }));

      // Create detailed items sheet if items exist
      const itemsData = data.flatMap(receipt => 
        (receipt.items || []).map(item => ({
          'Receipt File': receipt.fileName,
          'Receipt Date': new Date(receipt.date).toLocaleDateString(),
          'Merchant': receipt.merchant,
          'Item Name': item.name,
          'Quantity': item.quantity,
          'Price': item.price,
          'Total': item.quantity * item.price,
        }))
      );

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add receipts summary sheet
      const receiptsSheet = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, receiptsSheet, "Receipts Summary");

      // Add items detail sheet if items exist
      if (itemsData.length > 0) {
        const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
        XLSX.utils.book_append_sheet(workbook, itemsSheet, "Items Detail");
      }

      // Add summary statistics sheet
      const totalAmount = data.reduce((sum, receipt) => sum + receipt.total, 0);
      const categories = [...new Set(data.map(r => r.category))];
      const categoryTotals = categories.map(category => ({
        'Category': category,
        'Count': data.filter(r => r.category === category).length,
        'Total Amount': data.filter(r => r.category === category).reduce((sum, r) => sum + r.total, 0),
      }));

      const summaryData = [
        { 'Metric': 'Total Receipts', 'Value': data.length },
        { 'Metric': 'Total Amount', 'Value': `$${totalAmount.toFixed(2)}` },
        { 'Metric': 'Average Amount', 'Value': `$${(totalAmount / data.length).toFixed(2)}` },
        { 'Metric': 'Date Range', 'Value': `${new Date(Math.min(...data.map(d => new Date(d.date).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...data.map(d => new Date(d.date).getTime()))).toLocaleDateString()}` },
        { 'Metric': '', 'Value': '' }, // Empty row
        { 'Metric': 'Category Breakdown', 'Value': '' },
        ...categoryTotals.map(cat => ({ 'Metric': cat.Category, 'Value': `${cat.Count} receipts - $${cat['Total Amount'].toFixed(2)}` }))
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `receipt-data-${currentDate}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Excel file downloaded successfully!",
        description: `Downloaded ${data.length} receipts to ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Error downloading file",
        description: "There was an error creating the Excel file",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Button
        onClick={downloadExcel}
        disabled={disabled || data.length === 0}
        className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-accent"
        size="lg"
      >
        <Download className="h-4 w-4 mr-2" />
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Download Excel Report
      </Button>
    </motion.div>
  );
};