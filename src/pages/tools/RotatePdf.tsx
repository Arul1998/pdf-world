import { useState } from 'react';
import { RotateCw, RotateCcw, Download, Loader2, FileText } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { rotatePages, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const RotatePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const rotateLeft = () => setRotation((prev) => prev - 90);
  const rotateRight = () => setRotation((prev) => prev + 90);

  // Normalize rotation to 0, 90, 180, or 270 for the actual PDF operation
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  const handleRotate = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (normalizedRotation === 0) {
      toast.error('Please rotate the PDF first');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const rotated = await rotatePages(files[0].file, normalizedRotation as 90 | 180 | 270);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', `_rotated_${normalizedRotation}.pdf`);
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

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate all pages of a PDF by clicking left or right."
      icon={RotateCw}
      category="edit"
      categoryColor="edit"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles.slice(0, 1));
            setRotation(0);
          }}
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
                  className="transition-transform duration-300 ease-out"
                  style={{ transform: `rotate(${rotation}deg)` }}
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

            {/* Rotation buttons */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={rotateLeft}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <RotateCcw className="w-8 h-8 text-foreground" />
                <span className="text-sm font-medium">Rotate Left</span>
              </button>
              <button
                onClick={rotateRight}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <RotateCw className="w-8 h-8 text-foreground" />
                <span className="text-sm font-medium">Rotate Right</span>
              </button>
            </div>

            {normalizedRotation !== 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Rotation: {normalizedRotation}°
              </p>
            )}
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleRotate}
          disabled={files.length === 0 || isProcessing || normalizedRotation === 0}
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
