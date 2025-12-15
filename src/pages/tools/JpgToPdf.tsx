import { useState } from 'react';
import { Image, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { imageToPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const JpgToPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      setProgress(30);
      const imageFiles = files.map(f => f.file);
      const pdf = await imageToPdf(imageFiles);
      setProgress(80);
      
      const filename = files.length === 1 
        ? files[0].name.replace(/\.(jpg|jpeg|png)$/i, '.pdf')
        : `images_${new Date().toISOString().split('T')[0]}.pdf`;
      
      downloadBlob(pdf, filename);
      setProgress(100);
      
      toast.success('Images converted to PDF!');
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert images. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="JPG to PDF"
      description="Convert JPG and PNG images to a PDF document."
      icon={Image}
      category="convert to pdf"
      categoryColor="convert-to"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.jpg', '.jpeg', '.png']}
          files={files}
          onFilesChange={setFiles}
          multiple
        />

        {files.length > 1 && (
          <p className="text-sm text-muted-foreground text-center">
            {files.length} images will be combined into a single PDF in the order shown above.
          </p>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
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
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PDF
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default JpgToPdf;
