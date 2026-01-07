import { useState } from 'react';
import { FileSearch, Download, Loader2, Languages } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ocrPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'pol', name: 'Polish' },
  { code: 'rus', name: 'Russian' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'chi_tra', name: 'Chinese (Traditional)' },
  { code: 'kor', name: 'Korean' },
  { code: 'ara', name: 'Arabic' },
];

const OcrPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [language, setLanguage] = useState('eng');
  const [extractedText, setExtractedText] = useState<string | null>(null);

  const handleOcr = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(5);
    setProgressText('Initializing OCR...');
    setExtractedText(null);

    try {
      const result = await ocrPdf(
        files[0].file,
        language,
        (currentPage, totalPages, status) => {
          const pageProgress = (currentPage / totalPages) * 90;
          setProgress(5 + pageProgress);
          setProgressText(status || `Processing page ${currentPage} of ${totalPages}...`);
        }
      );
      
      setProgress(100);
      setProgressText('Complete!');
      setExtractedText(result.text);
      
      downloadBlob(result.pdfData, files[0].name.replace('.pdf', '_searchable.pdf'));
      toast.success(`OCR complete! Processed ${result.pageCount} pages.`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to process PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const handleCopyText = () => {
    if (!extractedText) return;
    navigator.clipboard.writeText(extractedText);
    toast.success('Text copied to clipboard!');
  };

  const handleDownloadText = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = files[0].name.replace('.pdf', '_text.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Text file downloaded!');
  };

  return (
    <ToolLayout
      title="OCR PDF"
      description="Make scanned PDFs searchable by extracting text using optical character recognition."
      icon={FileSearch}
      category="optimize"
      categoryColor="optimize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles.slice(0, 1));
            setExtractedText(null);
          }}
          multiple={false}
          hideFileList={false}
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {files.length > 0 && (
          <div className="p-4 bg-muted/50 rounded-xl space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Document Language
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the primary language of the document for better accuracy.
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            <p className="text-sm text-center text-muted-foreground">{progressText}</p>
          </div>
        )}

        {/* Extracted text preview */}
        {extractedText && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Extracted Text Preview</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyText}>
                  Copy Text
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadText}>
                  Download TXT
                </Button>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
              {extractedText.slice(0, 2000)}
              {extractedText.length > 2000 && (
                <span className="text-muted-foreground">... (truncated)</span>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={handleOcr}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing OCR...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              {extractedText ? 'Process Again' : 'Make Searchable & Download'}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          OCR uses Tesseract.js to recognize text. Processing time depends on document size and complexity.
        </p>
      </div>
    </ToolLayout>
  );
};

export default OcrPdf;
