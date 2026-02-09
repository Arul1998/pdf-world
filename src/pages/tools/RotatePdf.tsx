import { useState } from 'react';
import { RotateCw, RotateCcw, Download, Loader2, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { PdfFileCard } from '@/components/PdfFileCard';
import { ProgressBar } from '@/components/ProgressBar';
import { SuccessResult } from '@/components/SuccessResult';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { rotatePages, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const RotatePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [rotation, setRotation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const rotateLeft = () => setRotation((prev) => prev - 90);
  const rotateRight = () => setRotation((prev) => prev + 90);

  const normalizedRotation = ((rotation % 360) + 360) % 360;

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleReset = () => {
    setFiles([]);
    setRotation(0);
    setIsComplete(false);
  };

  const handleRotate = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    if (normalizedRotation === 0) {
      toast.error('Please rotate the PDF first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        const rotated = await rotatePages(files[0].file, normalizedRotation as 90 | 180 | 270);
        setProgress(80);
        
        const filename = files[0].name.replace('.pdf', `_rotated_${normalizedRotation}.pdf`);
        downloadBlob(rotated, filename);
        setProgress(100);
        
        toast.success('PDF rotated successfully!');
      } else {
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          const rotated = await rotatePages(files[i].file, normalizedRotation as 90 | 180 | 270);
          const filename = files[i].name.replace('.pdf', `_rotated_${normalizedRotation}.pdf`);
          zip.file(filename, rotated);
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rotated_pdfs_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} PDFs rotated successfully!`);
      }
      setIsComplete(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to rotate PDF. The file may be corrupted.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  if (isComplete) {
    return (
      <ToolLayout
        title="Rotate PDF"
        description="Rotate all pages of PDF files by clicking left or right."
        icon={RotateCw}
        category="edit"
        categoryColor="edit"
      >
        <SuccessResult
          message={`${files.length} PDF${files.length > 1 ? 's' : ''} rotated ${normalizedRotation}°!`}
          detail={files.length > 1 ? 'Downloaded as ZIP archive' : undefined}
          onReset={handleReset}
        />
      </ToolLayout>
    );
  }

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate all pages of PDF files by clicking left or right."
      icon={RotateCw}
      category="edit"
      categoryColor="edit"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles);
            setRotation(0);
          }}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-6">
            {/* Header with clear all */}
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

            {/* File thumbnails grid with rotation preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((file) => (
                <PdfFileCard
                  key={file.id}
                  file={file}
                  onRemove={removeFile}
                  rotation={rotation}
                />
              ))}
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
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Rotating file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
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
              Rotate & Download {files.length > 1 ? 'ZIP' : ''}
            </>
          )}
        </Button>

        {files.length > 1 && !isProcessing && (
          <p className="text-sm text-muted-foreground text-center">
            Multiple files will be downloaded as a ZIP archive.
          </p>
        )}
      </div>
    </ToolLayout>
  );
};

export default RotatePdf;
