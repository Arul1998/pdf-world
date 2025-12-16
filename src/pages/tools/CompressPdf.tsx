import { useState } from 'react';
import { Minimize2, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';

const CompressPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ original: number; compressed: number } | null>(null);

  const handleCompress = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      setProgress(30);
      const originalSize = files[0].size;
      const compressed = await compressPdf(files[0].file);
      setProgress(80);
      
      const compressedSize = compressed.length;
      setResult({ original: originalSize, compressed: compressedSize });
      
      const filename = files[0].name.replace('.pdf', '_compressed.pdf');
      downloadBlob(compressed, filename);
      setProgress(100);
      
      const savings = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      if (compressedSize < originalSize) {
        toast.success(`PDF compressed! Saved ${savings}%`);
      } else {
        toast.info('PDF is already optimized. Downloaded as-is.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to compress PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ToolLayout
      title="Compress PDF"
      description="Reduce PDF file size while maintaining quality."
      icon={Minimize2}
      category="optimize"
      categoryColor="optimize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles.slice(0, 1));
            setResult(null);
          }}
          multiple={false}
          hideFileList
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        {result && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-xl">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className="text-lg font-semibold text-foreground">{formatFileSize(result.original)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compressed</p>
                <p className="text-lg font-semibold text-success">{formatFileSize(result.compressed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings</p>
                <p className="text-lg font-semibold text-success">
                  {result.compressed < result.original 
                    ? `${((1 - result.compressed / result.original) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleCompress}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Compressing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Compress & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default CompressPdf;
