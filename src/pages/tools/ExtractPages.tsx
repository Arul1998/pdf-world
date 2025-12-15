import { useState } from 'react';
import { FileOutput, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { extractPages, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const ExtractPages = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [pagesToExtract, setPagesToExtract] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const parsePages = (input: string): number[] => {
    const results: number[] = [];
    const parts = input.split(',').map(s => s.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (!results.includes(i)) results.push(i);
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && !results.includes(num)) {
          results.push(num);
        }
      }
    }
    
    return results.sort((a, b) => a - b);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    const pages = parsePages(pagesToExtract);
    if (pages.length === 0) {
      toast.error('Please enter valid page numbers (e.g., "1, 3, 5-7")');
      return;
    }

    const pageCount = files[0].pageCount || 0;
    for (const page of pages) {
      if (page < 1 || page > pageCount) {
        toast.error(`Invalid page: ${page}. PDF has ${pageCount} pages.`);
        return;
      }
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await extractPages(files[0].file, pages);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_extracted.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success(`Extracted ${pages.length} page(s) successfully!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to extract pages. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Extract Pages"
      description="Extract specific pages from your PDF to create a new document."
      icon={FileOutput}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
        />

        {files.length > 0 && files[0].pageCount && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
            <div className="text-sm text-muted-foreground">
              Total pages: <span className="font-semibold text-foreground">{files[0].pageCount}</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pages">Pages to extract</Label>
              <Input
                id="pages"
                placeholder="e.g., 1, 3, 5-7"
                value={pagesToExtract}
                onChange={(e) => setPagesToExtract(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate page numbers with commas. Use "-" for ranges.
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleExtract}
          disabled={files.length === 0 || !pagesToExtract || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Extract & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default ExtractPages;
