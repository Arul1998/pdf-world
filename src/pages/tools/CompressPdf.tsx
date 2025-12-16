import { useState } from 'react';
import { Minimize2, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';

interface CompressionResult {
  name: string;
  original: number;
  compressed: number;
}

const CompressPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressionResult[]>([]);

  const handleCompress = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      const compressionResults: CompressionResult[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const originalSize = file.size;
        const compressed = await compressPdf(file.file);
        const compressedSize = compressed.length;
        
        const filename = file.name.replace('.pdf', '_compressed.pdf');
        downloadBlob(compressed, filename);
        
        compressionResults.push({
          name: file.name,
          original: originalSize,
          compressed: compressedSize,
        });
        
        setProgress(((i + 1) / files.length) * 100);
      }
      
      setResults(compressionResults);
      
      const totalOriginal = compressionResults.reduce((sum, r) => sum + r.original, 0);
      const totalCompressed = compressionResults.reduce((sum, r) => sum + r.compressed, 0);
      const savings = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
      
      if (totalCompressed < totalOriginal) {
        toast.success(`${files.length} PDF${files.length > 1 ? 's' : ''} compressed! Saved ${savings}%`);
      } else {
        toast.info('PDFs are already optimized. Downloaded as-is.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to compress PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalOriginal = results.reduce((sum, r) => sum + r.original, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressed, 0);

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
            setFiles(newFiles);
            setResults([]);
          }}
          multiple={true}
        />

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        {results.length > 0 && (
          <div className="p-4 bg-success/10 border border-success/20 rounded-xl space-y-4">
            {results.length > 1 && (
              <div className="grid grid-cols-3 gap-4 text-center border-b border-success/20 pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Original</p>
                  <p className="text-lg font-semibold text-foreground">{formatFileSize(totalOriginal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Compressed</p>
                  <p className="text-lg font-semibold text-success">{formatFileSize(totalCompressed)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Savings</p>
                  <p className="text-lg font-semibold text-success">
                    {totalCompressed < totalOriginal 
                      ? `${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}%`
                      : '0%'
                    }
                  </p>
                </div>
              </div>
            )}
            {results.map((result, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="truncate" title={result.name}>
                  <p className="text-xs text-muted-foreground">File</p>
                  <p className="font-medium text-foreground truncate">{result.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{formatFileSize(result.original)} → {formatFileSize(result.compressed)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {result.compressed < result.original 
                      ? <span className="text-success font-medium">-{((1 - result.compressed / result.original) * 100).toFixed(1)}%</span>
                      : <span className="text-muted-foreground">0%</span>
                    }
                  </p>
                </div>
              </div>
            ))}
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
