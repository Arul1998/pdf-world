import { useState } from 'react';
import { RotateCw, Download, Loader2, FileText } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { rotatePages, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const RotatePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [rotation, setRotation] = useState<'90' | '180' | '270'>('90');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRotate = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const rotated = await rotatePages(files[0].file, parseInt(rotation) as 90 | 180 | 270);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', `_rotated_${rotation}.pdf`);
      downloadBlob(rotated, filename);
      setProgress(100);
      
      toast.success('PDF rotated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to rotate PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const rotationDegrees = parseInt(rotation);

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate all pages of a PDF by 90°, 180°, or 270°."
      icon={RotateCw}
      category="edit"
      categoryColor="edit"
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
          <div className="space-y-6">
            {/* PDF Preview with rotation */}
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">Preview</p>
              <div className="relative w-48 h-64 flex items-center justify-center bg-muted/30 rounded-xl overflow-hidden">
                <div 
                  className="transition-transform duration-500 ease-out"
                  style={{ transform: `rotate(${rotationDegrees}deg)` }}
                >
                  {files[0].thumbnail ? (
                    <img
                      src={files[0].thumbnail}
                      alt={files[0].name}
                      className="max-w-32 max-h-44 object-contain rounded-lg shadow-lg border border-border"
                    />
                  ) : (
                    <div className="w-32 h-44 bg-card border border-border rounded-lg flex items-center justify-center shadow-lg">
                      <FileText className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground truncate max-w-48" title={files[0].name}>
                {files[0].name}
              </p>
            </div>

            {/* Rotation options */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <Label>Rotation angle</Label>
              <RadioGroup value={rotation} onValueChange={(v) => setRotation(v as typeof rotation)}>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: '90', label: '90° Right', icon: '↻' },
                    { value: '180', label: '180°', icon: '↕' },
                    { value: '270', label: '90° Left', icon: '↺' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        rotation === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className="text-2xl">{option.icon}</span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleRotate}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Rotating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Rotate & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default RotatePdf;
