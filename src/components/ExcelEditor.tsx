import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Save, Download, Trash2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ExcelRowData {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  description: string;
  fileName?: string;
}

interface ExcelEditorProps {
  initialData?: ExcelRowData[];
  onDataChange?: (data: ExcelRowData[]) => void;
}

export const ExcelEditor = ({ initialData = [], onDataChange }: ExcelEditorProps) => {
  const [data, setData] = useState<ExcelRowData[]>(initialData);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: keyof ExcelRowData } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  const addNewRow = () => {
    const newRow: ExcelRowData = {
      id: `row_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      merchant: '',
      category: '',
      amount: 0,
      description: ''
    };
    setData([...data, newRow]);
  };

  const updateCell = (rowIndex: number, field: keyof ExcelRowData, value: string | number) => {
    const newData = [...data];
    if (field === 'amount') {
      newData[rowIndex][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else {
      newData[rowIndex][field] = value as any;
    }
    setData(newData);
  };

  const deleteRow = (rowIndex: number) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    toast({
      title: "Row deleted",
      description: "Row has been removed from the spreadsheet",
    });
  };

  const saveToExcel = () => {
    if (data.length === 0) {
      toast({
        title: "No data to save",
        description: "Please add some data first",
        variant: "destructive",
      });
      return;
    }

    try {
      const exportData = data.map(row => ({
        'Date': row.date,
        'Merchant/Vendor': row.merchant,
        'Category': row.category,
        'Amount ($)': row.amount,
        'Description': row.description,
        'Source File': row.fileName || 'Manual Entry'
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, Object.values(r).map(val => val.toString().length).reduce((a, b) => Math.max(a, b), 0)), 10);
      worksheet['!cols'] = Array(6).fill({ wch: Math.min(maxWidth, 20) });

      XLSX.utils.book_append_sheet(workbook, worksheet, "Receipt Data");

      const fileName = `receipt-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Excel file saved!",
        description: `Downloaded ${data.length} entries to ${fileName}`,
      });
    } catch (error) {
      toast({
        title: "Error saving file",
        description: "There was an error creating the Excel file",
        variant: "destructive",
      });
    }
  };

  const getTotalAmount = () => {
    return data.reduce((sum, row) => sum + (row.amount || 0), 0);
  };

  const handleCellClick = (rowIndex: number, field: keyof ExcelRowData) => {
    setEditingCell({ rowIndex, field });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent, rowIndex: number, field: keyof ExcelRowData) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      setEditingCell(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Receipt Data Editor
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={addNewRow} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button onClick={saveToExcel} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Save Excel
            </Button>
          </div>
        </div>
        
        {data.length > 0 && (
          <div className="flex gap-4 text-sm">
            <Badge variant="secondary">
              Total Entries: {data.length}
            </Badge>
            <Badge variant="secondary">
              Total Amount: ${getTotalAmount().toFixed(2)}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[200px]">Merchant/Vendor</TableHead>
                  <TableHead className="w-[150px]">Category</TableHead>
                  <TableHead className="w-[120px]">Amount ($)</TableHead>
                  <TableHead className="w-[250px]">Description</TableHead>
                  <TableHead className="w-[150px]">Source</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {data.map((row, rowIndex) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="group hover:bg-muted/30"
                    >
                      <TableCell>
                        {editingCell?.rowIndex === rowIndex && editingCell?.field === 'date' ? (
                          <Input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateCell(rowIndex, 'date', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyPress(e, rowIndex, 'date')}
                            className="h-8 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent/20 p-1 rounded min-h-[32px] flex items-center"
                            onClick={() => handleCellClick(rowIndex, 'date')}
                          >
                            {row.date}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingCell?.rowIndex === rowIndex && editingCell?.field === 'merchant' ? (
                          <Input
                            value={row.merchant}
                            onChange={(e) => updateCell(rowIndex, 'merchant', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyPress(e, rowIndex, 'merchant')}
                            className="h-8 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent/20 p-1 rounded min-h-[32px] flex items-center"
                            onClick={() => handleCellClick(rowIndex, 'merchant')}
                          >
                            {row.merchant || 'Click to edit'}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingCell?.rowIndex === rowIndex && editingCell?.field === 'category' ? (
                          <Input
                            value={row.category}
                            onChange={(e) => updateCell(rowIndex, 'category', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyPress(e, rowIndex, 'category')}
                            className="h-8 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent/20 p-1 rounded min-h-[32px] flex items-center"
                            onClick={() => handleCellClick(rowIndex, 'category')}
                          >
                            {row.category || 'Click to edit'}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingCell?.rowIndex === rowIndex && editingCell?.field === 'amount' ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateCell(rowIndex, 'amount', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyPress(e, rowIndex, 'amount')}
                            className="h-8 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent/20 p-1 rounded min-h-[32px] flex items-center"
                            onClick={() => handleCellClick(rowIndex, 'amount')}
                          >
                            ${row.amount.toFixed(2)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingCell?.rowIndex === rowIndex && editingCell?.field === 'description' ? (
                          <Input
                            value={row.description}
                            onChange={(e) => updateCell(rowIndex, 'description', e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={(e) => handleKeyPress(e, rowIndex, 'description')}
                            className="h-8 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-accent/20 p-1 rounded min-h-[32px] flex items-center"
                            onClick={() => handleCellClick(rowIndex, 'description')}
                          >
                            {row.description || 'Click to edit'}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.fileName ? 'OCR Extracted' : 'Manual'}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRow(rowIndex)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </div>

        {data.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-muted-foreground"
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No data yet. Upload receipts or add rows manually to get started.</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};