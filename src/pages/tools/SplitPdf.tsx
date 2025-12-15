import { useState } from 'react';
import { Scissors, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { splitPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const SplitPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [ranges, setRanges] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const parseRanges = (input: string): { start: number; end: number }[] => {
    const results: { start: number; end: number }[] = [];
    const parts = input.split(',').map(s => s.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          results.push({ start, end });
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num)) {
          results.push({ start: num, end: num });
        }
      }
    }
    
    return results;
  };

  const handleSplit = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    const parsedRanges = parseRanges(ranges);
    if (parsedRanges.length === 0) {
      toast.error('Please enter valid page ranges (e.g., "1-3, 5, 7-10")');
      return;
    }

    const pageCount = files[0].pageCount || 0;
    for (const range of parsedRanges) {
      if (range.start < 1 || range.end > pageCount) {
        toast.error(`Invalid range: ${range.start}-${range.end}. PDF has ${pageCount} pages.`);
        return;
      }
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const results = await splitPdf(files[0].file, parsedRanges);
      
      for (let i = 0; i < results.length; i++) {
        const range = parsedRanges[i];
        const filename = `split_${range.start}-${range.end}.pdf`;
        downloadBlob(results[i], filename);
        setProgress(((i + 1) / results.length) * 100);
        await new Promise(r => setTimeout(r, 300));
      }
      
      toast.success(`PDF split into ${results.length} file(s)!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to split PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Split PDF"
      description="Separate a PDF into multiple documents by specifying page ranges."
      icon={Scissors}
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
              <Label htmlFor="ranges">Page ranges to extract</Label>
              <Input
                id="ranges"
                placeholder="e.g., 1-3, 5, 7-10"
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate ranges with commas. Use "-" for ranges (e.g., 1-5 means pages 1 through 5).
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleSplit}
          disabled={files.length === 0 || !ranges || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Splitting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Split & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default SplitPdf;
