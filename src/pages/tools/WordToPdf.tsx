import { createBatchArchive } from '@/lib/batch';
import { useState } from 'react';
import { FileText, Download, Loader2, X, Archive } from 'lucide-react';
import * as mammoth from 'mammoth';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { generateId, formatFileSize, readFileAsArrayBuffer, downloadBlob } from '@/lib/pdf-tools';

interface WordFile {
  id: string;
  name: string;
  file: File;
  size: number;
}

const WordToPdf = () => {
  const [files, setFiles] = useState<WordFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');

  const handleFilesChange = (newFiles: { id?: string; name: string; file: File; size: number }[]) => {
    const wordFiles: WordFile[] = newFiles.map((f) => ({
      id: f.id || generateId(),
      name: f.name,
      file: f.file,
      size: f.size,
    }));
    setFiles(wordFiles);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const resetAll = () => {
    setFiles([]);
    setProgress(0);
    setCurrentFile('');
  };

  const convertWordToPdf = async (file: File): Promise<Uint8Array> => {
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Extract text from DOCX (best-effort). Some complex layouts may not map 1:1.
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = (result.value || '').replace(/\r\n/g, '\n');

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    const pageWidth = 595.28; // A4 in points
    const pageHeight = 841.89;
    const margin = 48;
    const fontSize = 12;
    const lineHeight = Math.round(fontSize * 1.35);

    const wrapLine = (line: string, maxWidth: number): string[] => {
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];

      const lines: string[] = [];
      let current = words[0];

      for (let i = 1; i < words.length; i++) {
        const candidate = `${current} ${words[i]}`;
        const width = font.widthOfTextAtSize(candidate, fontSize);

        if (width <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = words[i];
        }
      }

      lines.push(current);
      return lines;
    };

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin - fontSize;
    const maxTextWidth = pageWidth - margin * 2;

    const paragraphs = text.split('\n');

    for (let p = 0; p < paragraphs.length; p++) {
      const para = paragraphs[p].trimEnd();

      // Blank line
      if (!para.trim()) {
        y -= lineHeight;
        if (y < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin - fontSize;
        }
        continue;
      }

      const wrapped = wrapLine(para, maxTextWidth);
      for (const line of wrapped) {
        page.drawText(line, { x: margin, y, size: fontSize, font });
        y -= lineHeight;

        if (y < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin - fontSize;
        }
      }

      // Paragraph spacing
      y -= Math.round(lineHeight * 0.35);
      if (y < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin - fontSize;
      }
    }

    return pdfDoc.save();
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one Word document');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        // Single file conversion
        setCurrentFile(files[0].name);
        setProgress(20);

        const pdfBytes = await convertWordToPdf(files[0].file);
        setProgress(90);

        const filename = files[0].name.replace(/\.(docx?|doc)$/i, '.pdf');
        downloadBlob(pdfBytes, filename);

        setProgress(100);
        toast.success('Word document converted to PDF!');
      } else {
        const batch = await createBatchArchive(files, async (item, index) => {
          setCurrentFile(item.name);
          setProgress((index / files.length) * 80);
          return { name: item.name.replace(/\.docx$/i, '.pdf'), data: await convertWordToPdf(item.file) };
        });
        downloadBlob(batch.data, `word-to-pdf_${new Date().toISOString().split('T')[0]}.zip`, 'application/zip');
        setProgress(100);
        const message = `${batch.succeeded} converted; ${batch.failed} failed. See the ZIP report for details.`;
        if (batch.failed) toast.warning(message); else toast.success(message);
      }

      resetAll();
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert. Please ensure the file is a valid Word document.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="Word to PDF"
      description="Export DOCX text to PDF. Original formatting, tables, and images are not preserved."
      icon={FileText}
      category="convert to pdf"
      categoryColor="convert-to"
    >
      <div className="space-y-6">
        <FileDropZone
            accept={['.docx']}
            files={files}
            hideFileList
            onFilesChange={handleFilesChange}
            multiple
          />
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                {files.length} {files.length === 1 ? 'document' : 'documents'} selected
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetAll}>
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg p-4">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-info" />
                      <div>
                        <p className="font-medium text-sm truncate max-w-[300px]">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            {currentFile && (
              <p className="text-sm text-muted-foreground text-center">
                Converting: {currentFile}
              </p>
            )}
            <ProgressBar progress={progress} />
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
              Convert {files.length} Files & Download ZIP
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PDF
            </>
          )}
        </Button>

        {files.length > 1 && (
          <p className="text-sm text-muted-foreground text-center">
            Multiple files will be converted and downloaded as a ZIP archive.
          </p>
        )}

        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Note:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Supports .docx documents; legacy .doc files are not supported</li>
            <li>Text-only export: formatting, tables, and images are not preserved</li>
            <li>Use Word or LibreOffice export when original layout must be preserved</li>
            <li>All processing happens in your browser - files are never uploaded</li>
          </ul>
        </div>
      </div>
    </ToolLayout>
  );
};

export default WordToPdf;
