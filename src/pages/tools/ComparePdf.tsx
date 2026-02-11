import { useState, useEffect, useCallback } from 'react';
import { GitCompare, Loader2, ArrowLeftRight } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { comparePdfs, downloadBlob, generatePdfPageThumbnails, type PDFFile } from '@/lib/pdf-tools';
import { PdfFileCard } from '@/components/PdfFileCard';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { SuccessResult } from '@/components/SuccessResult';

const ComparePdf = () => {
  const [file1, setFile1] = useState<PDFFile[]>([]);
  const [file2, setFile2] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnails1, setThumbnails1] = useState<string[]>([]);
  const [thumbnails2, setThumbnails2] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadThumbnails = useCallback(async () => {
    if (file1.length === 0 && file2.length === 0) {
      setThumbnails1([]);
      setThumbnails2([]);
      return;
    }

    setIsLoadingThumbnails(true);
    
    try {
      const thumbsPromises = [];
      
      if (file1.length > 0) {
        thumbsPromises.push(
          generatePdfPageThumbnails(file1[0].file, 0.4)
            .then(thumbs => ({ type: 'file1', thumbs }))
        );
      }
      
      if (file2.length > 0) {
        thumbsPromises.push(
          generatePdfPageThumbnails(file2[0].file, 0.4)
            .then(thumbs => ({ type: 'file2', thumbs }))
        );
      }

      const results = await Promise.all(thumbsPromises);
      
      results.forEach(result => {
        if (result.type === 'file1') {
          setThumbnails1(result.thumbs);
        } else {
          setThumbnails2(result.thumbs);
        }
      });
    } catch (error) {
      console.error('Failed to load thumbnails:', error);
      toast.error('Failed to load file previews');
    } finally {
      setIsLoadingThumbnails(false);
    }
  }, [file1, file2]);

  useEffect(() => {
    loadThumbnails();
    setCurrentPage(0);
    setZoomLevel(1);
  }, [file1, file2, loadThumbnails]);

  const handleCompare = async () => {
    if (file1.length === 0 || file2.length === 0) {
      toast.error('Please add both PDF files to compare');
      return;
    }

    setIsProcessing(true);
    setProgress(20);

    try {
      const result = await comparePdfs(file1[0].file, file2[0].file, (p) => setProgress(20 + p * 0.6));
      setProgress(90);
      
      downloadBlob(result, 'pdf_comparison.pdf');
      setProgress(100);
      
      toast.success('Comparison PDF generated successfully!');
      setShowSuccess(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to compare PDFs. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setFile1([]);
    setFile2([]);
    setThumbnails1([]);
    setThumbnails2([]);
    setCurrentPage(0);
    setZoomLevel(1);
    setShowSuccess(false);
  };

  const handleSwapFiles = () => {
    const temp = file1;
    setFile1(file2);
    setFile2(temp);
  };

  const maxPages = Math.max(thumbnails1.length, thumbnails2.length);

  if (showSuccess) {
    return (
      <ToolLayout
        title="Compare PDFs"
        description="Find visual differences between two PDF documents. Generates a side-by-side comparison with highlighted changes."
        icon={GitCompare}
        category="security"
        categoryColor="security"
      >
        <div className="space-y-6">
          <SuccessResult
            message="Comparison PDF generated successfully!"
            detail={`Original: ${file1[0]?.pageCount || 0} pages • Modified: ${file2[0]?.pageCount || 0} pages`}
            onReset={handleReset}
          />
          <PrivacyBadge />
        </div>
      </ToolLayout>
    );
  }

  return (
    <ToolLayout
      title="Compare PDFs"
      description="Find visual differences between two PDF documents. Generates a side-by-side comparison with highlighted changes."
      icon={GitCompare}
      category="security"
      categoryColor="security"
    >
      <div className="space-y-6">
        <PrivacyBadge />

        {/* How it works - always visible */}
        <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground">
          <p>
            <strong>How it works:</strong> Upload two PDFs to generate a comparison document showing them side by side. 
            Pages are compared visually, making it easy to spot any changes between versions.
          </p>
        </div>

        {/* Two file drop zones side by side */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Original PDF</h3>
            <FileDropZone
              accept={['.pdf']}
              files={file1}
              onFilesChange={(newFiles) => setFile1(newFiles.slice(0, 1))}
              multiple={false}
              hideFileList
              buttonText="Select Original"
              buttonTextWithFiles="Change Original"
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Modified PDF</h3>
            <FileDropZone
              accept={['.pdf']}
              files={file2}
              onFilesChange={(newFiles) => setFile2(newFiles.slice(0, 1))}
              multiple={false}
              hideFileList
              buttonText="Select Modified"
              buttonTextWithFiles="Change Modified"
            />
          </div>
        </div>

        {/* File cards with info */}
        {(file1.length > 0 || file2.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {file1.length > 0 && (
              <PdfFileCard
                file={file1[0]}
                onRemove={() => setFile1([])}
                extraInfo={`${file1[0].pageCount} page${file1[0].pageCount !== 1 ? 's' : ''}`}
              />
            )}
            {file2.length > 0 && (
              <PdfFileCard
                file={file2[0]}
                onRemove={() => setFile2([])}
                extraInfo={`${file2[0].pageCount} page${file2[0].pageCount !== 1 ? 's' : ''}`}
              />
            )}
          </div>
        )}

        {/* Thumbnail loading */}
        {isLoadingThumbnails && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Processing file previews...</span>
          </div>
        )}

        {/* Side by side preview */}
        {!isLoadingThumbnails && (thumbnails1.length > 0 || thumbnails2.length > 0) && (
          <div className="space-y-4">
            {/* Zoom controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}
                disabled={zoomLevel <= 0.5}
              >
                −
              </Button>
              <span className="text-sm text-muted-foreground w-16 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(z => Math.min(2, z + 0.2))}
                disabled={zoomLevel >= 2}
              >
                +
              </Button>
              {file1.length > 0 && file2.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSwapFiles}
                  className="ml-2"
                  title="Swap Original and Modified files"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Preview */}
            <div className="grid md:grid-cols-2 gap-4 overflow-auto">
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                {thumbnails1[currentPage] ? (
                  <img
                    src={thumbnails1[currentPage]}
                    alt={`Original Page ${currentPage + 1}`}
                    className="rounded shadow-sm"
                    style={{ maxHeight: `${400 * zoomLevel}px`, transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No page at this index</span>
                )}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[400px]">
                {thumbnails2[currentPage] ? (
                  <img
                    src={thumbnails2[currentPage]}
                    alt={`Modified Page ${currentPage + 1}`}
                    className="rounded shadow-sm"
                    style={{ maxHeight: `${400 * zoomLevel}px`, transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No page at this index</span>
                )}
              </div>
            </div>

            {/* Page navigation */}
            {maxPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1} of {maxPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(maxPages - 1, p + 1))}
                  disabled={currentPage >= maxPages - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        {/* Action buttons */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <Button
            onClick={handleCompare}
            disabled={file1.length === 0 || file2.length === 0 || isProcessing || isLoadingThumbnails}
            size="lg"
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-5 w-5" />
                Compare & Download
              </>
            )}
          </Button>
          {(file1.length > 0 || file2.length > 0) && (
            <Button
              variant="outline"
              onClick={handleReset}
              size="lg"
              disabled={isProcessing || isLoadingThumbnails}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>
    </ToolLayout>
  );
};

export default ComparePdf;
