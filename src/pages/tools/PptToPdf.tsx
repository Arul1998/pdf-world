import React, { useState } from 'react';
import { Presentation, Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

interface SlideContent {
  title: string;
  content: string[];
  slideNumber: number;
}

import type { PDFFile } from '@/lib/pdf-tools';

const PptToPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);

  const file = files[0]?.file ?? null;

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

  const convertToPdf = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(10);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setProgress(20);

      const slides = await parsePptx(arrayBuffer);
      setProgress(40);

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

        setProgress(40 + ((i + 1) / slides.length) * 50);
      }

      setProgress(95);
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const fileName = file.name.replace(/\.(pptx?|ppt)$/i, '.pdf');
      saveAs(blob, fileName);

      setProgress(100);
      toast.success(`Converted ${slides.length} slides to PDF!`);
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PowerPoint file');
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

        {files.length === 0 ? (
          <FileDropZone
            accept={['.ppt', '.pptx']}
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

export default PptToPdf;
