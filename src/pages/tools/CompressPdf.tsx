import { useState, useRef } from 'react';
import { Minimize2, Download, Loader2, Check, Trash2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { PdfFileCard } from '@/components/PdfFileCard';
import { ProgressBar } from '@/components/ProgressBar';
import { SuccessResult } from '@/components/SuccessResult';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

interface CompressionResult {
  name: string;
  original: number;
  compressed: number;
  data?: Uint8Array;
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
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<string>('');
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('balanced');
  const [isComplete, setIsComplete] = useState(false);
  
  const pageTimesRef = useRef<number[]>([]);
  const lastPageTimeRef = useRef<number>(0);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
    setResults([]);
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const calculateTotalPages = (): number => {
    return files.reduce((sum, f) => sum + (f.pageCount || 0), 0);
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setIsComplete(false);
  };

  const handleCompress = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setEstimatedTimeLeft('');
    pageTimesRef.current = [];
    lastPageTimeRef.current = Date.now();

    try {
      const compressionResults: CompressionResult[] = [];
      const totalPagesAll = calculateTotalPages();
      let pagesProcessed = 0;
      
      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        const file = files[i];
        const originalSize = file.size;
        
        const compressed = await compressPdf(file.file, compressionLevel, (page, total) => {
          setCurrentPage(page);
          setTotalPages(total);
          
          const now = Date.now();
          const pageTime = now - lastPageTimeRef.current;
          lastPageTimeRef.current = now;
          
          if (page > 1) {
            pageTimesRef.current.push(pageTime);
            if (pageTimesRef.current.length > 10) {
              pageTimesRef.current.shift();
            }
            
            const avgTimePerPage = pageTimesRef.current.reduce((a, b) => a + b, 0) / pageTimesRef.current.length;
            const remainingPages = totalPagesAll - pagesProcessed - page;
            const estimatedMs = remainingPages * avgTimePerPage;
            setEstimatedTimeLeft(formatTime(estimatedMs / 1000));
          }
        });
        
        pagesProcessed += file.pageCount || 0;
        const compressedSize = compressed.length;
        
        compressionResults.push({
          name: file.name,
          original: originalSize,
          compressed: compressedSize,
          data: compressed,
        });
        
        setProgress(((i + 1) / files.length) * 100);
      }
      
      // Download: zip if multiple files, otherwise single file
      if (compressionResults.length > 1) {
        const zip = new JSZip();
        compressionResults.forEach((result) => {
          const filename = result.name.replace('.pdf', '_compressed.pdf');
          zip.file(filename, result.data!);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'compressed_pdfs.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (compressionResults.length === 1) {
        const result = compressionResults[0];
        const filename = result.name.replace('.pdf', '_compressed.pdf');
        downloadBlob(result.data!, filename);
      }
      
      // Clear data from results to free memory
      setResults(compressionResults.map(r => ({ ...r, data: undefined })));
      
      const totalOriginal = compressionResults.reduce((sum, r) => sum + r.original, 0);
      const totalCompressed = compressionResults.reduce((sum, r) => sum + r.compressed, 0);
      const savings = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
      
      setIsComplete(true);
      
      if (totalCompressed < totalOriginal) {
        toast.success(`${files.length} PDF${files.length > 1 ? 's' : ''} compressed! Saved ${savings}%`);
      } else {
        toast.info('PDFs are already optimized. Downloaded as-is.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to compress PDF. The file may be corrupted or too large for browser processing.');
    } finally {
      setIsProcessing(false);
      setEstimatedTimeLeft('');
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
        {isComplete && results.length > 0 ? (
          <>
            {/* Compression Results */}
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
            <SuccessResult
              message={`${files.length} PDF${files.length > 1 ? 's' : ''} compressed!`}
              detail={totalCompressed < totalOriginal 
                ? `Saved ${((1 - totalCompressed / totalOriginal) * 100).toFixed(1)}% (${formatFileSize(totalOriginal - totalCompressed)})`
                : 'Files already optimized'
              }
              onReset={handleReset}
            />
          </>
        ) : (
          <>
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {files.length} file{files.length !== 1 ? 's' : ''} selected
                  </p>
                  {files.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-destructive gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear All
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {files.map((file) => (
                    <PdfFileCard
                      key={file.id}
                      file={file}
                      onRemove={removeFile}
                    />
                  ))}
                </div>
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
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-center">
                  Compressing file {currentFileIndex + 1} of {files.length}
                  {totalPages > 0 && ` — Page ${currentPage} of ${totalPages}`}
                  {estimatedTimeLeft && ` — ~${estimatedTimeLeft} remaining`}
                </p>
                <ProgressBar progress={progress} />
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
          </>
        )}
      </div>
    </ToolLayout>
  );
};

export default CompressPdf;
