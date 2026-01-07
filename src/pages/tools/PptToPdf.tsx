import React, { useState } from 'react';
import { Presentation, Download, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { toast } from 'sonner';

import { formatFileSize, downloadBlob, generateId, type PDFFile } from '@/lib/pdf-tools';

interface SlideContent {
  title: string;
  content: string[];
  slideNumber: number;
}

interface PptFile {
  id: string;
  name: string;
  file: File;
  size: number;
}

const PptToPdf = () => {
  const [files, setFiles] = useState<PptFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const handleFilesChange = (newFiles: PDFFile[]) => {
    const pptFiles: PptFile[] = newFiles.map((f) => ({
      id: f.id || generateId(),
      name: f.name,
      file: f.file,
      size: f.size,
    }));
    setFiles(pptFiles);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const extractTextFromXml = (xml: string): string[] => {
    const texts: string[] = [];
    const regex = /<a:t>([^<]*)<\/a:t>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      if (match[1].trim()) {
        texts.push(match[1].trim());
      }
    }
    return texts;
  };

  const parsePptx = async (arrayBuffer: ArrayBuffer): Promise<SlideContent[]> => {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slides: SlideContent[] = [];

    // Find all slide XML files
    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const content = await zip.files[slideFile].async('string');
      const texts = extractTextFromXml(content);

      slides.push({
        title: texts[0] || `Slide ${i + 1}`,
        content: texts.slice(1),
        slideNumber: i + 1,
      });
    }

    return slides;
  };

  const convertSingleFile = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    const slides = await parsePptx(arrayBuffer);

    if (slides.length === 0) {
      throw new Error('No slides found in the PowerPoint file');
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Standard slide dimensions (16:9 aspect ratio)
    const pageWidth = 960;
    const pageHeight = 540;
    const margin = 50;
    const titleSize = 28;
    const contentSize = 16;
    const lineHeight = contentSize * 1.5;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw slide background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(0.98, 0.98, 0.98),
      });

      // Draw slide border
      page.drawRectangle({
        x: 10,
        y: 10,
        width: pageWidth - 20,
        height: pageHeight - 20,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });

      let y = pageHeight - margin;

      // Draw title
      const title = slide.title.substring(0, 60);
      page.drawText(title, {
        x: margin,
        y: y - titleSize,
        size: titleSize,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.3),
      });

      y -= titleSize + 40;

      // Draw content
      for (const text of slide.content) {
        if (y < margin + 30) break;

        // Word wrap
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const width = font.widthOfTextAtSize(testLine, contentSize);
          if (width > pageWidth - margin * 2) {
            if (line) {
              page.drawText('• ' + line, {
                x: margin,
                y: y - contentSize,
                size: contentSize,
                font,
                color: rgb(0.2, 0.2, 0.2),
              });
              y -= lineHeight;
            }
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line && y >= margin + 30) {
          page.drawText('• ' + line, {
            x: margin,
            y: y - contentSize,
            size: contentSize,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= lineHeight * 1.5;
        }
      }

      // Draw slide number
      page.drawText(`${slide.slideNumber}`, {
        x: pageWidth - margin,
        y: 20,
        size: 12,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
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
        
        const fileName = files[0].name.replace(/\.(pptx?|ppt)$/i, '.pdf');
        downloadBlob(pdfBytes, fileName);
        
        setProgress(100);
        toast.success('PowerPoint converted to PDF!');
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          try {
            const pdfBytes = await convertSingleFile(files[i].file);
            const fileName = files[i].name.replace(/\.(pptx?|ppt)$/i, '.pdf');
            zip.file(fileName, pdfBytes);
          } catch (err) {
            console.warn(`Failed to convert ${files[i].name}:`, err);
          }
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ppt_to_pdf_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} PowerPoint files converted to PDF!`);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PowerPoint file');
    } finally {
      setIsConverting(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="PowerPoint to PDF"
      description="Convert PowerPoint presentations to PDF"
      icon={Presentation}
      category="Convert to PDF"
      categoryColor="convert-to"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This extracts text content from slides. Images, charts, and complex formatting are not preserved. For full fidelity, use Microsoft Office or Google Slides.
          </AlertDescription>
        </Alert>

        <FileDropZone
          accept={['.ppt', '.pptx']}
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
                  <Presentation className="w-10 h-10 text-orange-600" />
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

export default PptToPdf;
