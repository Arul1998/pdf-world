import { useState, useEffect, useCallback } from 'react';
import { GitCompare, Download, Loader2, ArrowLeftRight } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { comparePdfs, downloadBlob, generatePdfPageThumbnails, type PDFFile } from '@/lib/pdf-tools';

const ComparePdf = () => {
  const [file1, setFile1] = useState<PDFFile[]>([]);
  const [file2, setFile2] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnails1, setThumbnails1] = useState<string[]>([]);
  const [thumbnails2, setThumbnails2] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const loadThumbnails = useCallback(async () => {
    if (file1.length > 0) {
      const thumbs = await generatePdfPageThumbnails(file1[0].file, 0.4);
      setThumbnails1(thumbs);
    } else {
      setThumbnails1([]);
    }
    if (file2.length > 0) {
      const thumbs = await generatePdfPageThumbnails(file2[0].file, 0.4);
      setThumbnails2(thumbs);
    } else {
      setThumbnails2([]);
    }
  }, [file1, file2]);

  useEffect(() => {
    loadThumbnails();
    setCurrentPage(0);
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
    } catch (error) {
      console.error(error);
      toast.error('Failed to compare PDFs. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const maxPages = Math.max(thumbnails1.length, thumbnails2.length);

  return (
    <ToolLayout
      title="Compare PDFs"
      description="Find visual differences between two PDF documents. Generates a side-by-side comparison with highlighted changes."
      icon={GitCompare}
      category="security"
      categoryColor="security"
    >
      <div className="space-y-6">
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

        {/* Side by side preview */}
        {(thumbnails1.length > 0 || thumbnails2.length > 0) && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                {thumbnails1[currentPage] ? (
                  <img
                    src={thumbnails1[currentPage]}
                    alt={`Original Page ${currentPage + 1}`}
                    className="max-h-72 rounded shadow-sm"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">No page at this index</span>
                )}
              </div>
              <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                {thumbnails2[currentPage] ? (
                  <img
                    src={thumbnails2[currentPage]}
                    alt={`Modified Page ${currentPage + 1}`}
                    className="max-h-72 rounded shadow-sm"
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

            {/* Info */}
            <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground">
              <p>
                <strong>How it works:</strong> The comparison will generate a PDF showing both documents 
                side by side with visual differences highlighted. Pages are compared visually, making it 
                easy to spot any changes between the two versions.
              </p>
            </div>
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        <Button
          onClick={handleCompare}
          disabled={file1.length === 0 || file2.length === 0 || isProcessing}
          size="lg"
          className="w-full"
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
      </div>
    </ToolLayout>
  );
};

export default ComparePdf;
