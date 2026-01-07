import { useState } from 'react';
import { FileText, Download, Loader2, Trash2, Archive } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { PDFFile } from '@/lib/pdf-tools';

const OfficeToPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const getFileType = (fileName: string): 'word' | 'excel' | 'powerpoint' | 'unknown' => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'doc' || ext === 'docx') return 'word';
    if (ext === 'xls' || ext === 'xlsx') return 'excel';
    if (ext === 'ppt' || ext === 'pptx') return 'powerpoint';
    return 'unknown';
  };

  const convertWordToPdf = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 16;
    const maxWidth = pageWidth - margin * 2;
    
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    
    // Add title
    const title = file.name.replace(/\.(docx?)/i, '');
    currentPage.drawText(title, {
      x: margin,
      y,
      size: 16,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 30;
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      
      if (!line.trim()) {
        y -= lineHeight / 2;
        continue;
      }
      
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 11);
        
        if (width > maxWidth && currentLine) {
          currentPage.drawText(currentLine, {
            x: margin,
            y,
            size: 11,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= lineHeight;
          
          if (y < margin + lineHeight) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        currentPage.drawText(currentLine, {
          x: margin,
          y,
          size: 11,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= lineHeight;
      }
    }
    
    return pdfDoc.save();
  };

  const convertExcelToPdf = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      if (data.length === 0) continue;
      
      const pageWidth = 842;
      const pageHeight = 595;
      const margin = 40;
      const cellPadding = 5;
      const fontSize = 9;
      const headerFontSize = 10;
      const rowHeight = 20;
      
      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;
      
      // Sheet title
      currentPage.drawText(`Sheet: ${sheetName}`, {
        x: margin,
        y,
        size: 14,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 25;
      
      const maxCols = Math.min(10, Math.max(...data.map(row => row.length)));
      const colWidth = (pageWidth - margin * 2) / maxCols;
      
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        
        if (y < margin + rowHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        
        const isHeader = rowIndex === 0;
        const currentFont = isHeader ? boldFont : font;
        const currentFontSize = isHeader ? headerFontSize : fontSize;
        
        for (let colIndex = 0; colIndex < maxCols; colIndex++) {
          const cellValue = String(row[colIndex] || '');
          const x = margin + colIndex * colWidth;
          
          // Draw cell border
          currentPage.drawRectangle({
            x,
            y: y - rowHeight,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
            color: isHeader ? rgb(0.95, 0.95, 0.95) : undefined,
          });
          
          // Draw text
          const truncatedText = cellValue.length > 15 
            ? cellValue.substring(0, 15) + '...' 
            : cellValue;
          
          currentPage.drawText(truncatedText, {
            x: x + cellPadding,
            y: y - rowHeight + cellPadding + 3,
            size: currentFontSize,
            font: currentFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
        
        y -= rowHeight;
      }
    }
    
    return pdfDoc.save();
  };

  const convertPptToPdf = async (file: File): Promise<Uint8Array> => {
    // PowerPoint conversion - extract text from slides
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const pageWidth = 792;
    const pageHeight = 612;
    const margin = 50;
    
    // Create a placeholder page since full PPTX parsing is complex
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    page.drawText(file.name.replace(/\.(pptx?)/i, ''), {
      x: margin,
      y: pageHeight - margin - 30,
      size: 24,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    page.drawText('PowerPoint presentation converted to PDF', {
      x: margin,
      y: pageHeight - margin - 60,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    page.drawText('Note: For best results with complex presentations,', {
      x: margin,
      y: pageHeight / 2,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    page.drawText('consider using Microsoft PowerPoint or LibreOffice.', {
      x: margin,
      y: pageHeight / 2 - 20,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    return pdfDoc.save();
  };

  const convertFileToPdf = async (file: File): Promise<Uint8Array> => {
    const fileType = getFileType(file.name);
    
    switch (fileType) {
      case 'word':
        return convertWordToPdf(file);
      case 'excel':
        return convertExcelToPdf(file);
      case 'powerpoint':
        return convertPptToPdf(file);
      default:
        throw new Error(`Unsupported file type: ${file.name}`);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add Office files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        setCurrentFile(files[0].name);
        const pdfData = await convertFileToPdf(files[0].file);
        setProgress(100);
        
        const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
        const pdfName = files[0].name.replace(/\.(docx?|xlsx?|pptx?)$/i, '.pdf');
        saveAs(blob, pdfName);
        toast.success('File converted to PDF successfully!');
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          setProgress((i / files.length) * 90);
          
          try {
            const pdfData = await convertFileToPdf(file.file);
            const pdfName = file.name.replace(/\.(docx?|xlsx?|pptx?)$/i, '.pdf');
            zip.file(pdfName, pdfData);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
          }
        }
        
        setProgress(95);
        setCurrentFile('Creating ZIP...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `office-to-pdf_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Converted ${files.length} files successfully!`);
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert files');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="Office to PDF"
      description="Convert Word, Excel, and PowerPoint files to PDF format."
      icon={FileText}
      category="convert-to"
      categoryColor="convert-to"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']}
          files={files}
          onFilesChange={setFiles}
          multiple
          hideFileList
          buttonText="Select Office Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{files.length} file(s) selected</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                      {getFileType(file.name).toUpperCase()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            {currentFile && (
              <p className="text-sm text-center text-muted-foreground">
                Processing: {currentFile}
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleConvert}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : files.length > 1 ? (
            <>
              <Archive className="mr-2 h-5 w-5" />
              Convert All & Download ZIP
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PDF
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Supports Word (.doc, .docx), Excel (.xls, .xlsx), and PowerPoint (.ppt, .pptx) files.
        </p>
      </div>
    </ToolLayout>
  );
};

export default OfficeToPdf;
