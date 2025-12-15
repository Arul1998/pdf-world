import { useState } from 'react';
import { Hash, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { addPageNumbers, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

type Position = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

const PageNumbers = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [position, setPosition] = useState<Position>('bottom-center');
  const [format, setFormat] = useState('Page {n} of {total}');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAddNumbers = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await addPageNumbers(files[0].file, position, format);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_numbered.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('Page numbers added successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add page numbers. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Insert page numbers on each page of your PDF."
      icon={Hash}
      category="edit"
      categoryColor="edit"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
        />

        {files.length > 0 && (
          <div className="space-y-6 p-4 bg-muted/50 rounded-xl">
            <div className="space-y-3">
              <Label>Position</Label>
              <RadioGroup value={position} onValueChange={(v) => setPosition(v as Position)}>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'top-left', label: '↖' },
                    { value: 'top-center', label: '↑' },
                    { value: 'top-right', label: '↗' },
                    { value: 'bottom-left', label: '↙' },
                    { value: 'bottom-center', label: '↓' },
                    { value: 'bottom-right', label: '↘' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        position === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className="text-xl">{option.label}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Number format</Label>
              <Input
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="Page {n} of {total}"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{n}'} for current page, {'{total}'} for total pages
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleAddNumbers}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Add Numbers & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default PageNumbers;
