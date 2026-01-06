import { useState } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { copyPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const CopyPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [copies, setCopies] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleCopy = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (copies < 1 || copies > 10) {
      toast.error('Number of copies must be between 1 and 10');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const results = await copyPdf(files[0].file, copies);
      setProgress(80);
      
      const baseName = files[0].name.replace('.pdf', '');
      
      for (let i = 0; i < results.length; i++) {
        const filename = copies === 1 ? `${baseName}_copy.pdf` : `${baseName}_copy_${i + 1}.pdf`;
        downloadBlob(results[i], filename);
        // Small delay between downloads
        if (i < results.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
      
      setProgress(100);
      toast.success(`${copies} copy/copies created successfully!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to copy PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Copy PDF"
      description="Create one or more exact copies of your PDF document."
      icon={Copy}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
          hideFileList
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {files.length > 0 && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="file-info" className="text-muted-foreground text-sm">Selected file</Label>
                <p className="font-medium truncate">{files[0].name}</p>
              </div>
              {files[0].pageCount && (
                <div>
                  <Label className="text-muted-foreground text-sm">Pages</Label>
                  <p className="font-medium">{files[0].pageCount}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="copies">Number of copies</Label>
              <Input
                id="copies"
                type="number"
                min="1"
                max="10"
                value={copies}
                onChange={(e) => setCopies(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Create between 1 and 10 exact copies of your PDF.
              </p>
            </div>
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        <Button
          onClick={handleCopy}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating {copies > 1 ? 'Copies' : 'Copy'}...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Create {copies} {copies > 1 ? 'Copies' : 'Copy'} & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default CopyPdf;
