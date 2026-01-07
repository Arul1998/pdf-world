import React, { useState } from 'react';
import { Table2, Download, AlertTriangle, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { toast } from 'sonner';

import { formatFileSize, downloadBlob, generateId, type PDFFile } from '@/lib/pdf-tools';

interface ExcelFile {
  id: string;
  name: string;
  file: File;
  size: number;
}

const ExcelToPdf = () => {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const handleFilesChange = (newFiles: PDFFile[]) => {
    const excelFiles: ExcelFile[] = newFiles.map((f) => ({
      id: f.id || generateId(),
      name: f.name,
      file: f.file,
      size: f.size,
    }));
    setFiles(excelFiles);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const convertSingleFile = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Courier);
    const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const fontSize = 9;
    const lineHeight = 12;
    const margin = 50;
    const cellPadding = 5;

    for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex++) {
      const sheetName = workbook.SheetNames[sheetIndex];
      const worksheet = workbook.Sheets[sheetName];
      const data: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (data.length === 0) continue;

      // Calculate column widths
      const colWidths: number[] = [];
      for (const row of data) {
        for (let col = 0; col < row.length; col++) {
          const cellText = String(row[col] ?? '');
          const width = Math.min(font.widthOfTextAtSize(cellText, fontSize) + cellPadding * 2, 150);
          colWidths[col] = Math.max(colWidths[col] || 40, width);
        }
      }

      const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + margin * 2;
      const pageWidth = Math.max(totalWidth, 612);
      const pageHeight = 792;
      const contentHeight = pageHeight - margin * 2;
      const rowsPerPage = Math.floor(contentHeight / lineHeight) - 2;

      let currentRow = 0;
      while (currentRow < data.length) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        let y = pageHeight - margin;

        // Add sheet name header
        page.drawText(`Sheet: ${sheetName}`, {
          x: margin,
          y,
          size: 12,
          font: boldFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= lineHeight * 2;

        // Draw rows
        const endRow = Math.min(currentRow + rowsPerPage, data.length);
        for (let rowIdx = currentRow; rowIdx < endRow; rowIdx++) {
          const row = data[rowIdx];
          let x = margin;

          for (let colIdx = 0; colIdx < colWidths.length; colIdx++) {
            const cellText = String(row[colIdx] ?? '').substring(0, 30);
            const colWidth = colWidths[colIdx];

            // Draw cell border
            page.drawRectangle({
              x,
              y: y - lineHeight + 2,
              width: colWidth,
              height: lineHeight,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 0.5,
            });

            // Draw text
            page.drawText(cellText, {
              x: x + cellPadding,
              y: y - fontSize,
              size: fontSize,
              font: rowIdx === 0 ? boldFont : font,
              color: rgb(0.1, 0.1, 0.1),
            });

            x += colWidth;
          }
          y -= lineHeight;
        }

        currentRow = endRow;
      }
    }

    return pdfDoc.save();
  };

  const convertToPdf = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setProgress(10);

    try {
      if (files.length === 1) {
        const pdfBytes = await convertSingleFile(files[0].file);
        setProgress(90);
        
        const fileName = files[0].name.replace(/\.(xlsx?|xls)$/i, '.pdf');
        downloadBlob(pdfBytes, fileName);
        
        setProgress(100);
        toast.success('Excel converted to PDF successfully!');
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          const pdfBytes = await convertSingleFile(files[i].file);
          const fileName = files[i].name.replace(/\.(xlsx?|xls)$/i, '.pdf');
          zip.file(fileName, pdfBytes);
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `excel_to_pdf_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} Excel files converted to PDF!`);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert Excel file');
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Excel to PDF"
      description="Convert Excel spreadsheets to PDF documents"
      icon={Table2}
      category="Convert to PDF"
      categoryColor="convert-to"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This browser-based conversion creates a simple table layout. For complex formatting, charts, or formulas, use Microsoft Office or Google Docs.
          </AlertDescription>
        </Alert>

        <FileDropZone
          accept={['.xls', '.xlsx']}
          files={files.map(f => ({ id: f.id, name: f.name, file: f.file, size: f.size, pageCount: 1 }))}
          onFilesChange={handleFilesChange}
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
                  <Table2 className="w-10 h-10 text-green-600" />
                </div>

                <p className="text-xs font-medium text-foreground truncate w-full text-center" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
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
          onClick={convertToPdf}
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
              Convert to PDF {files.length > 1 ? '& Download ZIP' : ''}
            </>
          )}
        </Button>

        {files.length > 1 && !isConverting && (
          <p className="text-sm text-muted-foreground text-center">
            Multiple files will be downloaded as a ZIP archive.
          </p>
        )}
      </div>
    </ToolLayout>
  );
};

export default ExcelToPdf;
