import { useState } from 'react';
import { Globe, Download, Loader2, Plus, Trash2, Archive } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFFile } from '@/lib/pdf-tools';

interface HtmlFile extends PDFFile {
  content?: string;
}

const HtmlToPdf = () => {
  const [files, setFiles] = useState<HtmlFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');

  const handleFilesChange = async (newFiles: PDFFile[]) => {
    const htmlFiles: HtmlFile[] = [];
    for (const file of newFiles) {
      const content = await file.file.text();
      htmlFiles.push({ ...file, content });
    }
    setFiles(htmlFiles);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const convertHtmlToPdf = async (htmlContent: string, fileName: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Parse HTML and extract text content
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Get title
    const title = doc.querySelector('title')?.textContent || fileName;
    
    // Extract text content
    const extractText = (element: Element): string[] => {
      const lines: string[] = [];
      
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            lines.push(text);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();
          
          // Add spacing for block elements
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'li', 'br'].includes(tagName)) {
            if (lines.length > 0 && lines[lines.length - 1] !== '') {
              lines.push('');
            }
          }
          
          // Process children
          el.childNodes.forEach(processNode);
          
          // Add line break after block elements
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'li'].includes(tagName)) {
            lines.push('');
          }
        }
      };
      
      processNode(element);
      return lines;
    };
    
    const textLines = extractText(doc.body);
    
    // Create PDF pages
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const lineHeight = 16;
    const maxWidth = pageWidth - margin * 2;
    
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    
    // Add title
    currentPage.drawText(title, {
      x: margin,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 30;
    
    // Add horizontal line
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 20;
    
    // Add content
    for (const line of textLines) {
      if (y < margin + lineHeight) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      
      if (line === '') {
        y -= lineHeight / 2;
        continue;
      }
      
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 11);
        
        if (width > maxWidth) {
          if (currentLine) {
            if (y < margin + lineHeight) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
            }
            currentPage.drawText(currentLine, {
              x: margin,
              y,
              size: 11,
              font,
              color: rgb(0.2, 0.2, 0.2),
            });
            y -= lineHeight;
          }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        if (y < margin + lineHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
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

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add HTML files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        setCurrentFile(files[0].name);
        const pdfData = await convertHtmlToPdf(files[0].content || '', files[0].name);
        setProgress(100);
        
        const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' });
        saveAs(blob, files[0].name.replace(/\.(html?|htm)$/i, '.pdf'));
        toast.success('HTML converted to PDF successfully!');
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          setProgress((i / files.length) * 90);
          
          const pdfData = await convertHtmlToPdf(file.content || '', file.name);
          const pdfName = file.name.replace(/\.(html?|htm)$/i, '.pdf');
          zip.file(pdfName, pdfData);
        }
        
        setProgress(95);
        setCurrentFile('Creating ZIP...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `html-to-pdf_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Converted ${files.length} files successfully!`);
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert HTML to PDF');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="Web to PDF"
      description="Convert HTML files to PDF documents with preserved formatting."
      icon={Globe}
      category="convert-to"
      categoryColor="convert-to"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.html', '.htm']}
          files={files}
          onFilesChange={handleFilesChange}
          multiple
          hideFileList
          buttonText="Select HTML Files"
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
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[200px]">{file.name}</span>
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
          Converts HTML content to PDF. Complex CSS and JavaScript may not be fully preserved.
        </p>
      </div>
    </ToolLayout>
  );
};

export default HtmlToPdf;
