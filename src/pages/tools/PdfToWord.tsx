import { useState, useEffect } from 'react';
import { FileType, Download, Loader2, Trash2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFFile } from '@/lib/pdf-tools';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PagePreview {
  dataUrl: string;
  width: number;
  height: number;
}

interface ExtractedPage {
  pageNumber: number;
  textContent: string[];
}

const PdfToWord = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedPages, setExtractedPages] = useState<ExtractedPage[]>([]);
  const [pagesPreviews, setPagesPreviews] = useState<PagePreview[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingPages, setIsLoadingPages] = useState(false);

  // Load PDF previews
  useEffect(() => {
    const loadPreviews = async () => {
      if (files.length === 0) {
        setPagesPreviews([]);
        return;
      }
      setIsLoadingPages(true);
      try {
        const arrayBuffer = await files[0].file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const previews: PagePreview[] = [];
        
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const scale = 0.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          previews.push({
            dataUrl: canvas.toDataURL('image/jpeg', 0.7),
            width: viewport.width,
            height: viewport.height,
          });
        }
        
        setPagesPreviews(previews);
        setCurrentPageIndex(0);
      } catch (error) {
        console.error('Failed to load previews:', error);
        toast.error('Failed to load PDF preview');
      } finally {
        setIsLoadingPages(false);
      }
    };
    loadPreviews();
  }, [files]);

  const extractTextFromPdf = async (file: File): Promise<ExtractedPage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: ExtractedPage[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      setProgress((i / pdf.numPages) * 50);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group text items by their y position to form lines
      const lines: { y: number; text: string }[] = [];
      
      textContent.items.forEach((item: any) => {
        if ('str' in item && item.str.trim()) {
          const y = Math.round(item.transform[5]);
          const existingLine = lines.find(l => Math.abs(l.y - y) < 5);
          if (existingLine) {
            existingLine.text += ' ' + item.str;
          } else {
            lines.push({ y, text: item.str });
          }
        }
      });

      // Sort by y position (top to bottom)
      lines.sort((a, b) => b.y - a.y);
      
      pages.push({
        pageNumber: i,
        textContent: lines.map(l => l.text.trim()).filter(t => t),
      });
    }

    return pages;
  };

  const createWordDocument = async (pages: ExtractedPage[]): Promise<Blob> => {
    const children: Paragraph[] = [];

    pages.forEach((page, pageIndex) => {
      // Add page header
      if (pageIndex > 0) {
        children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
      }
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Page ${page.pageNumber}`,
              bold: true,
              size: 24,
              color: '666666',
            }),
          ],
          spacing: { after: 200 },
          alignment: AlignmentType.LEFT,
        })
      );

      // Add separator line
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '─'.repeat(50),
              color: 'CCCCCC',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Add text content
      page.textContent.forEach((line, lineIndex) => {
        // Detect if line might be a heading (short, possibly bold in original)
        const isHeading = line.length < 100 && lineIndex < 3 && line === line.toUpperCase();
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: isHeading ? 28 : 24,
                bold: isHeading,
              }),
            ],
            heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
            spacing: { after: 120 },
          })
        );
      });

      setProgress(50 + ((pageIndex + 1) / pages.length) * 50);
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Extract text from PDF
      const pages = await extractTextFromPdf(files[0].file);
      setExtractedPages(pages);

      // Create Word document
      const wordBlob = await createWordDocument(pages);

      // Download the file
      const fileName = files[0].name.replace('.pdf', '.docx');
      saveAs(wordBlob, fileName);

      toast.success('PDF converted to Word successfully!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PDF to Word');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const resetAll = () => {
    setFiles([]);
    setExtractedPages([]);
    setPagesPreviews([]);
    setCurrentPageIndex(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <ToolLayout
      title="PDF to Word"
      description="Convert PDF to editable Word document"
      icon={FileType}
      category="convert-from"
      categoryColor="convert-from"
    >
      <div className="space-y-6">
        {files.length === 0 ? (
          <FileDropZone
            accept={['.pdf']}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* PDF Preview */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">PDF Preview</Label>
                <Button variant="ghost" size="sm" onClick={resetAll}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  New File
                </Button>
              </div>

              {isLoadingPages ? (
                <div className="aspect-[3/4] bg-muted/50 rounded-lg flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pagesPreviews.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPageIndex === 0}
                      onClick={() => setCurrentPageIndex(i => i - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPageIndex + 1} of {pagesPreviews.length}
                      {pagesPreviews.length < 10 ? '' : ' (preview limited to first 10 pages)'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPageIndex === pagesPreviews.length - 1}
                      onClick={() => setCurrentPageIndex(i => i + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <img
                      src={pagesPreviews[currentPageIndex]?.dataUrl}
                      alt={`Page ${currentPageIndex + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Conversion Options */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">File Details</Label>
                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{files[0].name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(files[0].size)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-semibold">Output Format</Label>
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <FileType className="h-8 w-8 text-[hsl(262,83%,58%)]" />
                    <div>
                      <p className="font-medium">Microsoft Word (.docx)</p>
                      <p className="text-sm text-muted-foreground">
                        Editable document format
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This tool extracts text content from PDF. Complex layouts, images, and formatting may not be perfectly preserved.
                </p>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Converting...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <Button
                onClick={handleConvert}
                disabled={isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Convert to Word
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default PdfToWord;
