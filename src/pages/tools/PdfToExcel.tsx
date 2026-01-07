import React, { useState } from 'react';
import { Sheet, Download, AlertTriangle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

import type { PDFFile } from '@/lib/pdf-tools';

interface ExtractedTable {
  pageNumber: number;
  data: string[][];
}

const PdfToExcel = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [copied, setCopied] = useState(false);

  const file = files[0]?.file ?? null;

  const extractTablesFromPdf = async (): Promise<ExtractedTable[]> => {
    if (!file) return [];

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const extractedTables: ExtractedTable[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Group text items by their Y position (rows)
      const rowMap = new Map<number, { x: number; text: string }[]>();

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const y = Math.round(item.transform[5]);
          const x = Math.round(item.transform[4]);

          if (!rowMap.has(y)) {
            rowMap.set(y, []);
          }
          rowMap.get(y)!.push({ x, text: item.str.trim() });
        }
      }

      // Sort rows by Y position (top to bottom)
      const sortedYPositions = Array.from(rowMap.keys()).sort((a, b) => b - a);

      // Convert to table rows
      const tableRows: string[][] = [];
      for (const y of sortedYPositions) {
        const items = rowMap.get(y)!;
        // Sort by X position (left to right)
        items.sort((a, b) => a.x - b.x);

        // Detect columns by X position gaps
        const row: string[] = [];
        let currentCell = '';
        let lastX = -Infinity;

        for (const item of items) {
          if (item.x - lastX > 50) {
            if (currentCell) {
              row.push(currentCell.trim());
            }
            currentCell = item.text;
          } else {
            currentCell += ' ' + item.text;
          }
          lastX = item.x + item.text.length * 5; // Approximate width
        }
        if (currentCell) {
          row.push(currentCell.trim());
        }

        if (row.length > 0) {
          tableRows.push(row);
        }
      }

      if (tableRows.length > 0) {
        extractedTables.push({
          pageNumber: pageNum,
          data: tableRows,
        });
      }

      setProgress(20 + ((pageNum / pdf.numPages) * 60));
    }

    return extractedTables;
  };

  const convertToExcel = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(10);

    try {
      const extractedTables = await extractTablesFromPdf();
      setProgress(80);

      if (extractedTables.length === 0) {
        toast.error('No table data found in the PDF');
        return;
      }

      setTables(extractedTables);

      // Create workbook
      const workbook = XLSX.utils.book_new();

      for (const table of extractedTables) {
        // Normalize row lengths
        const maxCols = Math.max(...table.data.map(row => row.length));
        const normalizedData = table.data.map(row => {
          while (row.length < maxCols) {
            row.push('');
          }
          return row;
        });

        const worksheet = XLSX.utils.aoa_to_sheet(normalizedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, `Page ${table.pageNumber}`);
      }

      setProgress(90);
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = file.name.replace(/\.pdf$/i, '.xlsx');
      saveAs(blob, fileName);

      setProgress(100);
      toast.success('PDF converted to Excel successfully!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PDF to Excel');
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  const copyTableData = () => {
    if (tables.length === 0) return;

    const text = tables
      .map(table => 
        `Page ${table.pageNumber}:\n` +
        table.data.map(row => row.join('\t')).join('\n')
      )
      .join('\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Table data copied to clipboard');
  };

  const reset = () => {
    setFiles([]);
    setTables([]);
    setProgress(0);
  };

  return (
    <ToolLayout
      title="PDF to Excel"
      description="Extract tables from PDF to Excel spreadsheets"
      icon={Sheet}
      category="Convert from PDF"
      categoryColor="convert-from"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This tool extracts text positioned as tables from PDFs. Complex layouts, merged cells, and images may not convert accurately. Best for simple tabular data.
          </AlertDescription>
        </Alert>

        {files.length === 0 ? (
          <FileDropZone
            accept={['.pdf']}
            maxFiles={1}
            files={files}
            onFilesChange={(newFiles) => { setFiles(newFiles); setTables([]); }}
          />
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button variant="outline" onClick={reset} disabled={isConverting}>
                    Change File
                  </Button>
                </div>

                {isConverting && <ProgressBar progress={progress} />}

                <Button
                  onClick={convertToExcel}
                  disabled={isConverting}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isConverting ? 'Converting...' : 'Convert to Excel'}
                </Button>
              </CardContent>
            </Card>

            {tables.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Extracted Tables Preview</h3>
                    <Button variant="outline" size="sm" onClick={copyTableData}>
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy All
                        </>
                      )}
                    </Button>
                  </div>

                  <Tabs defaultValue={`page-${tables[0]?.pageNumber}`}>
                    <TabsList className="mb-4">
                      {tables.map(table => (
                        <TabsTrigger key={table.pageNumber} value={`page-${table.pageNumber}`}>
                          Page {table.pageNumber}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {tables.map(table => (
                      <TabsContent key={table.pageNumber} value={`page-${table.pageNumber}`}>
                        <div className="overflow-x-auto max-h-96 border rounded-lg">
                          <table className="w-full text-sm">
                            <tbody>
                              {table.data.slice(0, 20).map((row, rowIdx) => (
                                <tr key={rowIdx} className={rowIdx === 0 ? 'bg-muted font-medium' : 'border-t'}>
                                  {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="px-3 py-2 whitespace-nowrap">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {table.data.length > 20 && (
                            <p className="text-center text-sm text-muted-foreground py-2 border-t">
                              ... and {table.data.length - 20} more rows
                            </p>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default PdfToExcel;
