import { useState } from 'react';
import { FileStack, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { mergePdfs, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const MergePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('Please add at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const pdfFiles = files.map(f => f.file);
      const mergedPdf = await mergePdfs(pdfFiles, (p) => setProgress(p));
      
      const filename = `merged_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadBlob(mergedPdf, filename);
      
      toast.success('PDFs merged successfully!');
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to merge PDFs. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    setFiles(newFiles);
  };

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single document. Drag to reorder."
      icon={FileStack}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple
        />

        {files.length > 1 && (
          <div className="p-4 bg-muted/50 rounded-xl">
            <p className="text-sm text-muted-foreground mb-3">
              Drag files above to reorder, or use the buttons below:
            </p>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={file.id} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}.</span>
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFile(index, 'up')}
                    disabled={index === 0}
                    className="h-8 px-2"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveFile(index, 'down')}
                    disabled={index === files.length - 1}
                    className="h-8 px-2"
                  >
                    ↓
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            size="lg"
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Merge & Download
              </>
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
};

export default MergePdf;
