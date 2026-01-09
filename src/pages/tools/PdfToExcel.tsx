import React, { useState } from 'react';
import { Sheet, Download, AlertTriangle, Copy, Check, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { toast } from 'sonner';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

import { formatFileSize, type PDFFile } from '@/lib/pdf-tools';

interface ExtractedTable {
  pageNumber: number;
  data: string[][];
}

const PdfToExcel = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [tables, setTables] = useState<ExtractedTable[]>([]);
  const [copied, setCopied] = useState(false);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
    setTables([]);
  };

  const extractTablesFromPdf = async (file: File): Promise<ExtractedTable[]> => {
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
    }

    return extractedTables;
  };

  const createExcelFromTables = (tables: ExtractedTable[]): ArrayBuffer => {
    const workbook = XLSX.utils.book_new();

    for (const table of tables) {
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

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  };

  const convertToExcel = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setProgress(10);

    try {
      if (files.length === 1) {
        const extractedTables = await extractTablesFromPdf(files[0].file);
        setProgress(70);

        if (extractedTables.length === 0) {
          toast.error('No table data found in the PDF');
          return;
        }

        setTables(extractedTables);

        const excelBuffer = createExcelFromTables(extractedTables);
        setProgress(90);
        
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = files[0].name.replace(/\.pdf$/i, '.xlsx');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success('PDF converted to Excel successfully!');
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);

          try {
            const extractedTables = await extractTablesFromPdf(files[i].file);
            if (extractedTables.length > 0) {
              const excelBuffer = createExcelFromTables(extractedTables);
              const fileName = files[i].name.replace(/\.pdf$/i, '.xlsx');
              zip.file(fileName, excelBuffer);
            }
          } catch (err) {
            console.warn(`Failed to convert ${files[i].name}:`, err);
          }
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pdf_to_excel_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} PDFs converted to Excel!`);
      }
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

        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => { setFiles(newFiles); setTables([]); }}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="relative group bg-card border border-border rounded-xl p-3 flex flex-col items-center"
              >
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                  {file.thumbnail ? (
                    <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>

                <p className="text-xs font-medium text-foreground truncate w-full text-center" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} • {formatFileSize(file.size)}
                </p>
              </div>
            ))}
          </div>
        )}

        {isConverting && (
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Converting file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
        )}

        <Button
          onClick={convertToExcel}
          disabled={files.length === 0 || isConverting}
          className="w-full"
          size="lg"
        >
          {isConverting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Convert to Excel {files.length > 1 ? '& Download ZIP' : ''}
            </>
          )}
        </Button>

        {files.length > 1 && !isConverting && (
          <p className="text-sm text-muted-foreground text-center">
            Multiple files will be downloaded as a ZIP archive.
          </p>
        )}

        {tables.length > 0 && files.length === 1 && (
          <div className="p-6 bg-card border border-border rounded-xl">
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
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default PdfToExcel;
