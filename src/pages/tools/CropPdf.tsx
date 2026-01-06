import { useState, useEffect, useCallback } from 'react';
import { Crop, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cropPdf, downloadBlob, generatePdfPageThumbnails, type PDFFile } from '@/lib/pdf-tools';

const CropPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [applyToAll, setApplyToAll] = useState(true);
  
  // Crop values in percentage (0-100)
  const [cropValues, setCropValues] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  const loadThumbnails = useCallback(async () => {
    if (files.length === 0) return;
    const thumbs = await generatePdfPageThumbnails(files[0].file, 0.5);
    setThumbnails(thumbs);
  }, [files]);

  useEffect(() => {
    if (files.length > 0) {
      loadThumbnails();
      setSelectedPage(0);
      setCropValues({ top: 0, bottom: 0, left: 0, right: 0 });
    } else {
      setThumbnails([]);
    }
  }, [files, loadThumbnails]);

  const handleCrop = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    const { top, bottom, left, right } = cropValues;
    if (top === 0 && bottom === 0 && left === 0 && right === 0) {
      toast.error('Please set crop margins');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await cropPdf(files[0].file, cropValues, applyToAll ? undefined : [selectedPage + 1]);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_cropped.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('PDF cropped successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to crop PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const updateCropValue = (key: keyof typeof cropValues, value: string) => {
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    setCropValues(prev => ({ ...prev, [key]: numValue }));
  };

  return (
    <ToolLayout
      title="Crop PDF"
      description="Trim margins and resize PDF pages by specifying crop percentages."
      icon={Crop}
      category="edit"
      categoryColor="edit"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
          hideFileList
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {files.length > 0 && thumbnails.length > 0 && (
          <div className="space-y-6">
            {/* Preview with crop overlay */}
            <div className="relative flex justify-center">
              <div className="relative inline-block">
                <img
                  src={thumbnails[selectedPage]}
                  alt={`Page ${selectedPage + 1}`}
                  className="max-h-80 rounded-lg border shadow-sm"
                />
                {/* Crop overlay */}
                <div 
                  className="absolute inset-0 border-2 border-primary border-dashed pointer-events-none"
                  style={{
                    top: `${cropValues.top}%`,
                    bottom: `${cropValues.bottom}%`,
                    left: `${cropValues.left}%`,
                    right: `${cropValues.right}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-primary/10" />
                </div>
                {/* Shaded areas being cropped */}
                {cropValues.top > 0 && (
                  <div className="absolute top-0 left-0 right-0 bg-black/40" style={{ height: `${cropValues.top}%` }} />
                )}
                {cropValues.bottom > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40" style={{ height: `${cropValues.bottom}%` }} />
                )}
                {cropValues.left > 0 && (
                  <div className="absolute left-0 bg-black/40" style={{ width: `${cropValues.left}%`, top: `${cropValues.top}%`, bottom: `${cropValues.bottom}%` }} />
                )}
                {cropValues.right > 0 && (
                  <div className="absolute right-0 bg-black/40" style={{ width: `${cropValues.right}%`, top: `${cropValues.top}%`, bottom: `${cropValues.bottom}%` }} />
                )}
              </div>
            </div>

            {/* Page selector */}
            {thumbnails.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                {thumbnails.map((thumb, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPage(index)}
                    className={`flex-shrink-0 rounded-lg border-2 overflow-hidden transition-all ${
                      selectedPage === index ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <img src={thumb} alt={`Page ${index + 1}`} className="h-16 w-auto" />
                    <div className="text-xs text-center py-1 bg-muted">{index + 1}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Crop controls */}
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <Label>Apply to all pages</Label>
                <Switch checked={applyToAll} onCheckedChange={setApplyToAll} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="top">Top (%)</Label>
                  <Input
                    id="top"
                    type="number"
                    min="0"
                    max="100"
                    value={cropValues.top}
                    onChange={(e) => updateCropValue('top', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bottom">Bottom (%)</Label>
                  <Input
                    id="bottom"
                    type="number"
                    min="0"
                    max="100"
                    value={cropValues.bottom}
                    onChange={(e) => updateCropValue('bottom', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="left">Left (%)</Label>
                  <Input
                    id="left"
                    type="number"
                    min="0"
                    max="100"
                    value={cropValues.left}
                    onChange={(e) => updateCropValue('left', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="right">Right (%)</Label>
                  <Input
                    id="right"
                    type="number"
                    min="0"
                    max="100"
                    value={cropValues.right}
                    onChange={(e) => updateCropValue('right', e.target.value)}
                  />
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Specify percentage of each edge to crop. The dashed box shows the final area.
              </p>
            </div>
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        <Button
          onClick={handleCrop}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cropping...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Crop & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default CropPdf;
