import { useState } from 'react';
import { FileImage, Download, Loader2, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { PdfFileCard } from '@/components/PdfFileCard';
import { ProgressBar } from '@/components/ProgressBar';
import { SuccessResult } from '@/components/SuccessResult';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { pdfToImages, type PDFFile } from '@/lib/pdf-tools';

const PdfToJpg = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleReset = () => {
    setFiles([]);
    setIsComplete(false);
    setResultCount(0);
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      const date = new Date().toISOString().split('T')[0];
      let totalImages = 0;

      for (let i = 0; i < files.length; i++) {
        setCurrentFileIndex(i);
        setProgress((i / files.length) * 90);

        const convertedImages = await pdfToImages(files[i].file, format);
        totalImages += convertedImages.length;

        const baseName = files[i].name.replace('.pdf', '');
        convertedImages.forEach((dataUrl, pageIndex) => {
          const base64Data = dataUrl.split(',')[1];
          const filename = files.length === 1 
            ? `page_${pageIndex + 1}.${format}`
            : `${baseName}/page_${pageIndex + 1}.${format}`;
          zip.file(filename, base64Data, { base64: true });
        });
      }

      setProgress(95);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = files.length === 1 
        ? `${files[0].name.replace('.pdf', '')}_images.zip`
        : `pdf_to_${format}_${date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setProgress(100);
      setResultCount(totalImages);
      setIsComplete(true);
      toast.success(`Converted ${totalImages} page(s) to ${format.toUpperCase()}!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert PDF. The file may be corrupted or too large.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  if (isComplete) {
    return (
      <ToolLayout
        title="PDF to JPG"
        description="Convert PDF pages to high-quality images."
        icon={FileImage}
        category="convert from pdf"
        categoryColor="convert-from"
      >
        <SuccessResult
          message={`Converted ${resultCount} page(s) to ${format.toUpperCase()}!`}
          detail="Downloaded as ZIP archive"
          onReset={handleReset}
        />
      </ToolLayout>
    );
  }

  return (
    <ToolLayout
      title="PDF to JPG"
      description="Convert PDF pages to high-quality images."
      icon={FileImage}
      category="convert from pdf"
      categoryColor="convert-from"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <>
            {/* File cards */}
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

            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <Label>Output format</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: 'jpeg', label: 'JPEG', desc: 'Smaller file size' },
                    { value: 'png', label: 'PNG', desc: 'Lossless quality' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        format === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.desc}</span>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Converting file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
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
              Convert & Download ZIP
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground text-center">
          Images will be downloaded as a ZIP archive.
        </p>
      </div>
    </ToolLayout>
  );
};

export default PdfToJpg;
