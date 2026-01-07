import { useState, useEffect, useCallback } from 'react';
import { Crop, Download, Loader2, X, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cropPdf, downloadBlob, generatePdfPageThumbnails, formatFileSize, type PDFFile } from '@/lib/pdf-tools';

const CropPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
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
    const thumbs = await generatePdfPageThumbnails(files[selectedFileIndex].file, 0.5);
    setThumbnails(thumbs);
  }, [files, selectedFileIndex]);

  useEffect(() => {
    if (files.length > 0) {
      loadThumbnails();
      setSelectedPage(0);
    } else {
      setThumbnails([]);
    }
  }, [files, loadThumbnails]);

  const removeFile = (id: string) => {
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    if (selectedFileIndex >= newFiles.length && newFiles.length > 0) {
      setSelectedFileIndex(newFiles.length - 1);
    }
  };

  const handleCrop = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    const { top, bottom, left, right } = cropValues;
    if (top === 0 && bottom === 0 && left === 0 && right === 0) {
      toast.error('Please set crop margins');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        const result = await cropPdf(files[0].file, cropValues, applyToAll ? undefined : [selectedPage + 1]);
        setProgress(80);
        
        const filename = files[0].name.replace('.pdf', '_cropped.pdf');
        downloadBlob(result, filename);
        setProgress(100);
        
        toast.success('PDF cropped successfully!');
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          const result = await cropPdf(files[i].file, cropValues);
          const filename = files[i].name.replace('.pdf', '_cropped.pdf');
          zip.file(filename, result);
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cropped_pdfs_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} PDFs cropped successfully!`);
      }
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
          onFilesChange={(newFiles) => {
            setFiles(newFiles);
            setCropValues({ top: 0, bottom: 0, left: 0, right: 0 });
            setSelectedFileIndex(0);
          }}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-6">
            {/* File thumbnails grid */}
            {files.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setSelectedFileIndex(index);
                      setSelectedPage(0);
                    }}
                    className={`relative group bg-card border-2 rounded-xl p-2 flex flex-col items-center cursor-pointer transition-all ${
                      selectedFileIndex === index ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-1 flex items-center justify-center">
                      {file.thumbnail ? (
                        <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-foreground truncate w-full text-center">{file.name}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Preview with crop overlay */}
            {thumbnails.length > 0 && (
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
            )}

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
              {files.length === 1 && (
                <div className="flex items-center justify-between">
                  <Label>Apply to all pages</Label>
                  <Switch checked={applyToAll} onCheckedChange={setApplyToAll} />
                </div>
              )}
              
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

        {isProcessing && (
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Cropping file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
        )}

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
              Crop & Download {files.length > 1 ? 'ZIP' : ''}
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

export default CropPdf;
