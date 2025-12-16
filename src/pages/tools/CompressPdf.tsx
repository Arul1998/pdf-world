import { useState } from 'react';
import { Minimize2, Download, Loader2, Check, X, FileText } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

interface CompressionResult {
  name: string;
  original: number;
  compressed: number;
}

type CompressionLevel = 'maximum' | 'balanced' | 'minimum';

const compressionOptions: { 
  id: CompressionLevel; 
  title: string; 
  description: string; 
  color: string;
}[] = [
  { 
    id: 'maximum', 
    title: 'Maximum Compression', 
    description: 'Smaller file size, reduced quality',
    color: 'text-destructive'
  },
  { 
    id: 'balanced', 
    title: 'Balanced', 
    description: 'Optimal balance of size and quality',
    color: 'text-warning'
  },
  { 
    id: 'minimum', 
    title: 'Minimum Compression', 
    description: 'Best quality, larger file size',
    color: 'text-success'
  },
];

const CompressPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('balanced');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
    setResults([]);
  };

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
          hideFileList
        />

        {/* Selected Files Preview */}
        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="relative group bg-card border border-border rounded-xl p-3 flex flex-col items-center"
              >
                {/* Remove button */}
                <button
                  onClick={() => removeFile(file.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Thumbnail */}
                <div className="w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>

                {/* File info */}
                <p className="text-xs font-medium text-foreground truncate w-full text-center" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} • {formatFileSize(file.size)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Compression Level Options */}
        <div className="space-y-2">
          {compressionOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setCompressionLevel(option.id)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                compressionLevel === option.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30 bg-card"
              )}
            >
              <div>
                <p className={cn("font-semibold uppercase text-sm tracking-wide", option.color)}>
                  {option.title}
                </p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              {compressionLevel === option.id && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>

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
