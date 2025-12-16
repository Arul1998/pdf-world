import { useState } from 'react';
import { FileImage, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { pdfToImages, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const PdfToJpg = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImages([]);

    try {
      setProgress(20);
      const convertedImages = await pdfToImages(files[0].file, format);
      setProgress(80);
      setImages(convertedImages);
      
      toast.success(`Converted ${convertedImages.length} page(s) to ${format.toUpperCase()}`);
      setProgress(100);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = (dataUrl: string, index: number) => {
    const filename = `page_${index + 1}.${format}`;
    downloadBlob(dataUrl, filename, `image/${format}`);
  };

  const downloadAll = () => {
    images.forEach((img, i) => {
      setTimeout(() => downloadImage(img, i), i * 300);
    });
    toast.success('Downloading all images...');
  };

  return (
    <ToolLayout
      title="PDF to JPG"
      description="Convert each page of a PDF to a high-quality image."
      icon={FileImage}
      category="convert from pdf"
      categoryColor="convert-from"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles.slice(0, 1));
            setImages([]);
          }}
          multiple={false}
          hideFileList
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {files.length > 0 && images.length === 0 && (
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
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        {images.length === 0 ? (
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
                Convert to Images
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">{images.length} images ready</p>
              <Button onClick={downloadAll} size="sm">
                Download All
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img, index) => (
                <div
                  key={index}
                  className="group relative aspect-[3/4] bg-muted rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={img}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadImage(img, index)}
                    >
                      Download
                    </Button>
                  </div>
                  <span className="absolute bottom-2 right-2 text-xs bg-background/80 px-2 py-1 rounded">
                    Page {index + 1}
                  </span>
                </div>
              ))}
            </div>
            
            <Button
              variant="outline"
              onClick={() => {
                setFiles([]);
                setImages([]);
              }}
              className="w-full"
            >
              Convert Another PDF
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default PdfToJpg;
