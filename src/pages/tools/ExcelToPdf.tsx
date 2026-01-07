import React, { useState } from 'react';
import { Table2, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

import type { PDFFile } from '@/lib/pdf-tools';

const ExcelToPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const file = files[0]?.file ?? null;

  const convertToPdf = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(10);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      setProgress(40);

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

        setProgress(40 + ((sheetIndex + 1) / workbook.SheetNames.length) * 40);
      }

      setProgress(90);
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const fileName = file.name.replace(/\.(xlsx?|xls)$/i, '.pdf');
      saveAs(blob, fileName);

      setProgress(100);
      toast.success('Excel converted to PDF successfully!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert Excel file');
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  const reset = () => {
    setFiles([]);
    setProgress(0);
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

        {files.length === 0 ? (
          <FileDropZone
            accept={['.xls', '.xlsx']}
            maxFiles={1}
            files={files}
            onFilesChange={setFiles}
          />
        ) : (
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
                onClick={convertToPdf}
                disabled={isConverting}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                {isConverting ? 'Converting...' : 'Convert to PDF'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ToolLayout>
  );
};

export default ExcelToPdf;
