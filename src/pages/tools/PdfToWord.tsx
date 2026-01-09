import { useState, useEffect } from 'react';
import { FileType, Download, Loader2, Trash2, FileText, ChevronLeft, ChevronRight, ImageIcon, ScanText, Languages, AlignLeft, X, Archive } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from 'docx';
import JSZip from 'jszip';

// Common OCR languages supported by Tesseract.js
const OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'pol', name: 'Polish' },
  { code: 'rus', name: 'Russian' },
  { code: 'ukr', name: 'Ukrainian' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'tha', name: 'Thai' },
  { code: 'vie', name: 'Vietnamese' },
  { code: 'tur', name: 'Turkish' },
  { code: 'heb', name: 'Hebrew' },
];
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFFile } from '@/lib/pdf-tools';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PagePreview {
  dataUrl: string;
  width: number;
  height: number;
}

interface ExtractedImage {
  data: Uint8Array;
  width: number;
  height: number;
  pageNumber: number;
}

interface TextLine {
  text: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  alignment: 'left' | 'center' | 'right';
  y: number;
  x: number;
  spacing: number; // Gap to next line
}

interface ExtractedPage {
  pageNumber: number;
  textLines: TextLine[];
  ocrText: string[];
  images: ExtractedImage[];
  pageWidth: number;
}

const PdfToWord = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [extractedPages, setExtractedPages] = useState<ExtractedPage[]>([]);
  const [pagesPreviews, setPagesPreviews] = useState<PagePreview[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [enableOcr, setEnableOcr] = useState(false);
  const [ocrLanguages, setOcrLanguages] = useState<string[]>(['eng']);
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  // Load PDF previews for selected file
  useEffect(() => {
    const loadPreviews = async () => {
      if (files.length === 0) {
        setPagesPreviews([]);
        return;
      }
      const currentFile = files[selectedFileIndex] || files[0];
      if (!currentFile) return;
      
      setIsLoadingPages(true);
      try {
        const arrayBuffer = await currentFile.file.arrayBuffer();
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
}, [files, selectedFileIndex]);

  const extractImagesFromPage = async (page: any, pageNumber: number): Promise<ExtractedImage[]> => {
    const images: ExtractedImage[] = [];
    
    try {
      const operatorList = await page.getOperatorList();
      const commonObjs = page.commonObjs;
      const objs = page.objs;
      
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        // OPS.paintImageXObject = 85, OPS.paintInlineImageXObject = 86
        if (fn === 85 || fn === 86) {
          const imgName = operatorList.argsArray[i][0];
          let imgData: any = null;
          
          try {
            // Try to get from page objects first, then common objects
            if (objs.has(imgName)) {
              imgData = objs.get(imgName);
            } else if (commonObjs.has(imgName)) {
              imgData = commonObjs.get(imgName);
            }
            
            if (imgData && imgData.bitmap) {
              // Convert ImageBitmap to PNG data
              const canvas = document.createElement('canvas');
              canvas.width = imgData.bitmap.width;
              canvas.height = imgData.bitmap.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(imgData.bitmap, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j);
                }
                
                // Only include images larger than 50x50 pixels (skip tiny icons/artifacts)
                if (imgData.bitmap.width > 50 && imgData.bitmap.height > 50) {
                  images.push({
                    data: bytes,
                    width: imgData.bitmap.width,
                    height: imgData.bitmap.height,
                    pageNumber,
                  });
                }
              }
            } else if (imgData && imgData.data) {
              // Handle raw image data format
              const canvas = document.createElement('canvas');
              canvas.width = imgData.width;
              canvas.height = imgData.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx && imgData.width > 50 && imgData.height > 50) {
                const imgDataObj = new ImageData(
                  new Uint8ClampedArray(imgData.data),
                  imgData.width,
                  imgData.height
                );
                ctx.putImageData(imgDataObj, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j);
                }
                
                images.push({
                  data: bytes,
                  width: imgData.width,
                  height: imgData.height,
                  pageNumber,
                });
              }
            }
          } catch (imgError) {
            // Skip problematic images
            console.warn('Failed to extract image:', imgError);
          }
        }
      }
    } catch (error) {
      console.warn('Error extracting images from page:', error);
    }
    
    return images;
  };

  const performOcrOnPage = async (page: any, pageNumber: number, totalPages: number, languages: string[]): Promise<string[]> => {
    try {
      // Render page at higher resolution for better OCR
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return [];
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      // Convert canvas to blob for Tesseract
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      
      // Join multiple languages with + for Tesseract
      const langString = languages.join('+');
      const langNames = languages.map(l => OCR_LANGUAGES.find(lang => lang.code === l)?.name || l).join(', ');
      setProgressMessage(`OCR (${langNames}): Processing page ${pageNumber}/${totalPages}...`);
      
      // Perform OCR using Tesseract with selected languages
      const result = await Tesseract.recognize(blob, langString, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const ocrProgress = m.progress || 0;
            const baseProgress = 25 + ((pageNumber - 1) / totalPages) * 25;
            const pageProgress = (ocrProgress / totalPages) * 25;
            setProgress(baseProgress + pageProgress);
          }
        },
      });
      
      // Split recognized text into lines
      const lines = result.data.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      
      return lines;
    } catch (error) {
      console.warn('OCR error on page', pageNumber, error);
      return [];
    }
  };

  const extractTextFromPdf = async (file: File, extractImages: boolean, useOcr: boolean, languages: string[], preserveLayout: boolean): Promise<ExtractedPage[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: ExtractedPage[] = [];
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
      const baseProgress = useOcr ? (i / totalPages) * 25 : (i / totalPages) * 50;
      setProgress(baseProgress);
      setProgressMessage(`Extracting text from page ${i}/${totalPages}...`);
      
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const textContent = await page.getTextContent();
      
      // Extract images if enabled
      let pageImages: ExtractedImage[] = [];
      if (extractImages) {
        pageImages = await extractImagesFromPage(page, i);
      }
      
      // Extract text items with formatting info
      const textItems: Array<{
        text: string;
        x: number;
        y: number;
        fontSize: number;
        fontName: string;
        width: number;
      }> = [];
      
      textContent.items.forEach((item: any) => {
        if ('str' in item && item.str.trim()) {
          const transform = item.transform;
          const fontSize = Math.abs(transform[0]) || Math.abs(transform[3]) || 12;
          textItems.push({
            text: item.str,
            x: transform[4],
            y: transform[5],
            fontSize: fontSize,
            fontName: item.fontName || '',
            width: item.width || 0,
          });
        }
      });
      
      // Group text items by y position to form lines with formatting
      const lineGroups: Map<number, typeof textItems> = new Map();
      const tolerance = 5;
      
      textItems.forEach((item) => {
        const roundedY = Math.round(item.y / tolerance) * tolerance;
        const existing = lineGroups.get(roundedY);
        if (existing) {
          existing.push(item);
        } else {
          lineGroups.set(roundedY, [item]);
        }
      });
      
      // Convert to TextLine array with formatting
      const textLines: TextLine[] = [];
      const sortedYs = Array.from(lineGroups.keys()).sort((a, b) => b - a);
      
      sortedYs.forEach((y, index) => {
        const items = lineGroups.get(y)!;
        // Sort items by x position
        items.sort((a, b) => a.x - b.x);
        
        const combinedText = items.map(item => item.text).join(' ').trim();
        if (!combinedText) return;
        
        // Calculate average font size for the line
        const avgFontSize = items.reduce((sum, item) => sum + item.fontSize, 0) / items.length;
        
        // Detect font style from font name
        const fontNames = items.map(item => item.fontName.toLowerCase()).join(' ');
        const isBold = fontNames.includes('bold') || fontNames.includes('black') || fontNames.includes('heavy');
        const isItalic = fontNames.includes('italic') || fontNames.includes('oblique');
        
        // Determine alignment based on x position
        const avgX = items.reduce((sum, item) => sum + item.x, 0) / items.length;
        const lineWidth = items.reduce((sum, item) => sum + (item.width || item.text.length * avgFontSize * 0.5), 0);
        const leftMargin = items[0].x;
        const rightMargin = pageWidth - (items[items.length - 1].x + (items[items.length - 1].width || 0));
        
        let alignment: 'left' | 'center' | 'right' = 'left';
        if (preserveLayout) {
          const centerThreshold = pageWidth * 0.15;
          if (Math.abs(leftMargin - rightMargin) < centerThreshold && leftMargin > pageWidth * 0.2) {
            alignment = 'center';
          } else if (leftMargin > rightMargin + pageWidth * 0.2) {
            alignment = 'right';
          }
        }
        
        // Calculate spacing to next line
        const nextY = sortedYs[index + 1];
        const spacing = nextY ? y - nextY : avgFontSize * 1.5;
        
        textLines.push({
          text: combinedText,
          fontSize: avgFontSize,
          isBold,
          isItalic,
          alignment,
          y,
          x: leftMargin,
          spacing: Math.max(spacing, 0),
        });
      });
      
      pages.push({
        pageNumber: i,
        textLines,
        ocrText: [],
        images: pageImages,
        pageWidth,
      });
    }

    // Perform OCR if enabled and pages have little to no text
    if (useOcr) {
      const langNames = languages.map(l => OCR_LANGUAGES.find(lang => lang.code === l)?.name || l).join(', ');
      setProgressMessage(`Initializing OCR engine (${langNames})...`);
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        // Check if page has very little text (likely scanned)
        const hasLittleText = page.textLines.map(l => l.text).join(' ').length < 50;
        
        if (hasLittleText) {
          const pdfPage = await pdf.getPage(page.pageNumber);
          const ocrLines = await performOcrOnPage(pdfPage, page.pageNumber, totalPages, languages);
          page.ocrText = ocrLines;
        }
      }
    }

    return pages;
  };

  const createWordDocument = async (pages: ExtractedPage[]): Promise<Blob> => {
    const children: Paragraph[] = [];
    const totalPages = pages.length;

    pages.forEach((page, pageIndex) => {
      setProgress(50 + ((pageIndex + 1) / totalPages) * 50);
      setProgressMessage(`Creating Word document: page ${pageIndex + 1}/${totalPages}...`);
      
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

      // Add text content (prioritize regular text, fall back to OCR)
      const hasTextLines = page.textLines.length > 0;
      const isOcrText = !hasTextLines && page.ocrText.length > 0;
      
      if (isOcrText) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '(Text extracted via OCR)',
                italics: true,
                size: 18,
                color: '888888',
              }),
            ],
            spacing: { after: 100 },
          })
        );
        
        // Add OCR text as simple paragraphs
        page.ocrText.forEach((line) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24,
                }),
              ],
              spacing: { after: 120 },
            })
          );
        });
      } else {
        // Calculate base font size (most common font size in document)
        const fontSizes = page.textLines.map(l => l.fontSize);
        const baseFontSize = fontSizes.length > 0 
          ? fontSizes.sort((a, b) => 
              fontSizes.filter(v => v === a).length - fontSizes.filter(v => v === b).length
            ).pop() || 12
          : 12;
        
        page.textLines.forEach((line, lineIndex) => {
          // Determine if this is a heading based on font size and style
          const fontRatio = line.fontSize / baseFontSize;
          const isHeading = fontRatio > 1.3 || (line.isBold && fontRatio > 1.1);
          const isLargeHeading = fontRatio > 1.6;
          
          // Convert alignment
          let docAlignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
          if (line.alignment === 'center') docAlignment = AlignmentType.CENTER;
          else if (line.alignment === 'right') docAlignment = AlignmentType.RIGHT;
          
          // Calculate Word document font size (half-points)
          const wordFontSize = Math.round(line.fontSize * 2);
          
          // Calculate spacing based on original spacing
          const spacingAfter = Math.min(Math.round(line.spacing * 8), 400);
          
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.text,
                  size: wordFontSize,
                  bold: line.isBold || isHeading,
                  italics: line.isItalic,
                }),
              ],
              heading: isLargeHeading ? HeadingLevel.HEADING_1 : isHeading ? HeadingLevel.HEADING_2 : undefined,
              alignment: docAlignment,
              spacing: { after: spacingAfter },
            })
          );
        });
      }

      // Add images from this page
      if (page.images.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Images from page ${page.pageNumber}:`,
                italics: true,
                size: 20,
                color: '888888',
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );

        page.images.forEach((img) => {
          // Scale image to fit within reasonable document width (max 500px width)
          const maxWidth = 500;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            const scale = maxWidth / width;
            width = maxWidth;
            height = Math.round(height * scale);
          }

          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: img.data,
                  transformation: {
                    width,
                    height,
                  },
                  type: 'png',
                }),
              ],
              spacing: { after: 200 },
            })
          );
        });
      }
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
      toast.error('Please upload PDF file(s)');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage('Starting conversion...');

    try {
      const isBatch = files.length > 1;
      
      if (isBatch) {
        // Batch conversion with ZIP
        const zip = new JSZip();
        let totalImages = 0;
        let totalOcrPages = 0;
        
        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
          const file = files[fileIdx];
          const fileProgress = (fileIdx / files.length) * 100;
          setProgress(fileProgress);
          setProgressMessage(`Converting ${file.name} (${fileIdx + 1}/${files.length})...`);
          
          const pages = await extractTextFromPdf(file.file, includeImages, enableOcr, ocrLanguages, preserveFormatting);
          totalImages += pages.reduce((sum, p) => sum + p.images.length, 0);
          totalOcrPages += pages.filter(p => p.ocrText.length > 0).length;
          
          const wordBlob = await createWordDocument(pages);
          const fileName = file.name.replace('.pdf', '.docx');
          zip.file(fileName, wordBlob);
        }
        
        setProgressMessage('Creating ZIP archive...');
        setProgress(95);
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'converted-documents.zip');
        
        let successMsg = `${files.length} PDFs converted successfully!`;
        if (includeImages && totalImages > 0) {
          successMsg += ` ${totalImages} image${totalImages > 1 ? 's' : ''} included.`;
        }
        if (enableOcr && totalOcrPages > 0) {
          successMsg += ` OCR applied to ${totalOcrPages} page${totalOcrPages > 1 ? 's' : ''}.`;
        }
        toast.success(successMsg);
      } else {
        // Single file conversion
        const pages = await extractTextFromPdf(files[0].file, includeImages, enableOcr, ocrLanguages, preserveFormatting);
        setExtractedPages(pages);

        const totalImages = pages.reduce((sum, p) => sum + p.images.length, 0);
        const ocrPages = pages.filter(p => p.ocrText.length > 0).length;

        const wordBlob = await createWordDocument(pages);
        const fileName = files[0].name.replace('.pdf', '.docx');
        saveAs(wordBlob, fileName);

        let successMsg = 'PDF converted to Word successfully!';
        if (includeImages && totalImages > 0) {
          successMsg += ` ${totalImages} image${totalImages > 1 ? 's' : ''} included.`;
        }
        if (enableOcr && ocrPages > 0) {
          successMsg += ` OCR applied to ${ocrPages} page${ocrPages > 1 ? 's' : ''}.`;
        }
        toast.success(successMsg);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert PDF(s) to Word');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFileIndex >= index && selectedFileIndex > 0) {
      setSelectedFileIndex(prev => prev - 1);
    }
  };

  const resetAll = () => {
    setFiles([]);
    setExtractedPages([]);
    setPagesPreviews([]);
    setCurrentPageIndex(0);
    setSelectedFileIndex(0);
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
            multiple={true}
            files={files}
            onFilesChange={setFiles}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* PDF Preview */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  PDF Preview {files.length > 1 && `(${selectedFileIndex + 1}/${files.length})`}
                </Label>
                <Button variant="ghost" size="sm" onClick={resetAll}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
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
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Files ({files.length})
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('add-more-files')?.click()}
                  >
                    Add More
                  </Button>
                  <input
                    id="add-more-files"
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []).map(file => ({
                        id: crypto.randomUUID(),
                        file,
                        name: file.name,
                        size: file.size,
                      }));
                      setFiles(prev => [...prev, ...newFiles]);
                      e.target.value = '';
                    }}
                  />
                </div>
                <ScrollArea className="h-40 border rounded-lg bg-muted/30">
                  <div className="p-2 space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedFileIndex === index ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          setSelectedFileIndex(index);
                          setCurrentPageIndex(0);
                        }}
                      >
                        <FileText className="h-6 w-6 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
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

              <div className="space-y-4">
                <Label className="text-base font-semibold">Options</Label>
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Include Images</p>
                        <p className="text-xs text-muted-foreground">
                          Extract and embed images in Word
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={includeImages}
                      onCheckedChange={setIncludeImages}
                    />
                  </div>

                  <div className="border-t pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlignLeft className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Preserve Formatting</p>
                        <p className="text-xs text-muted-foreground">
                          Keep font sizes, styles & alignment
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={preserveFormatting}
                      onCheckedChange={setPreserveFormatting}
                    />
                  </div>
                  
                  <div className="border-t pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ScanText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">OCR for Scanned PDFs</p>
                          <p className="text-xs text-muted-foreground">
                            Extract text from scanned pages
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={enableOcr}
                        onCheckedChange={setEnableOcr}
                      />
                    </div>
                    
                    {enableOcr && (
                      <div className="pl-8 space-y-2">
                        <div className="flex items-center gap-3">
                          <Languages className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">OCR Languages</p>
                            <p className="text-xs text-muted-foreground">
                              Select languages for multilingual documents
                            </p>
                          </div>
                        </div>
                        <ScrollArea className="h-48 border rounded-md p-2 bg-background">
                          <div className="space-y-2">
                            {OCR_LANGUAGES.map((lang) => (
                              <div key={lang.code} className="flex items-center gap-2">
                                <Checkbox
                                  id={`lang-${lang.code}`}
                                  checked={ocrLanguages.includes(lang.code)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setOcrLanguages(prev => [...prev, lang.code]);
                                    } else {
                                      // Don't allow deselecting if it's the last one
                                      if (ocrLanguages.length > 1) {
                                        setOcrLanguages(prev => prev.filter(l => l !== lang.code));
                                      }
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`lang-${lang.code}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {lang.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        {ocrLanguages.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {ocrLanguages.map(l => OCR_LANGUAGES.find(lang => lang.code === l)?.name).join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This tool extracts text content from PDF. Complex layouts and formatting may not be perfectly preserved.
                  {includeImages && ' Images larger than 50x50 pixels will be included.'}
                  {enableOcr && ' OCR will be applied to pages with little or no text.'}
                  {files.length > 1 && ' Multiple files will be downloaded as a ZIP archive.'}
                </p>
              </div>

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{progressMessage || 'Converting...'}</span>
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
                ) : files.length > 1 ? (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Convert {files.length} PDFs & Download ZIP
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
