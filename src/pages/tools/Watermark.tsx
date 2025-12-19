import { useState, useEffect } from 'react';
import { Droplets, Download, Loader2, Image, Type, X, FileText } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { addWatermark, downloadBlob, generatePdfPageThumbnails, type PDFFile, type WatermarkPosition } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

type WatermarkType = 'text' | 'image';

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center-left', label: 'Center Left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'tile', label: 'Tile (Repeat)' },
];

const Watermark = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState([30]);
  const [rotation, setRotation] = useState([0]);
  const [fontSize, setFontSize] = useState([50]);
  const [position, setPosition] = useState<WatermarkPosition>('center');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState([30]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);

  // Generate thumbnails when PDF is loaded
  useEffect(() => {
    if (files.length > 0) {
      setLoadingThumbnails(true);
      generatePdfPageThumbnails(files[0].file, 0.4)
        .then(setPageThumbnails)
        .finally(() => setLoadingThumbnails(false));
    } else {
      setPageThumbnails([]);
    }
  }, [files]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAddWatermark = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (watermarkType === 'text' && !text.trim()) {
      toast.error('Please enter watermark text');
      return;
    }

    if (watermarkType === 'image' && !imageFile) {
      toast.error('Please select a watermark image');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await addWatermark(
        files[0].file, 
        watermarkType === 'text' ? text : '',
        {
          opacity: opacity[0] / 100,
          rotation: rotation[0],
          fontSize: fontSize[0],
          position,
          imageFile: watermarkType === 'image' ? imageFile! : undefined,
          imageScale: imageScale[0] / 100,
        }
      );
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_watermarked.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('Watermark added successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add watermark. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const getPositionStyle = (pos: WatermarkPosition): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute' };
    switch (pos) {
      case 'top-left': return { ...base, top: '8%', left: '8%' };
      case 'top-center': return { ...base, top: '8%', left: '50%', transform: 'translateX(-50%)' };
      case 'top-right': return { ...base, top: '8%', right: '8%' };
      case 'center-left': return { ...base, top: '50%', left: '8%', transform: 'translateY(-50%)' };
      case 'center': return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
      case 'center-right': return { ...base, top: '50%', right: '8%', transform: 'translateY(-50%)' };
      case 'bottom-left': return { ...base, bottom: '8%', left: '8%' };
      case 'bottom-center': return { ...base, bottom: '8%', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-right': return { ...base, bottom: '8%', right: '8%' };
      case 'diagonal': return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)' };
      default: return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  const renderWatermarkPreview = (isTile: boolean = false) => {
    if (watermarkType === 'image' && imagePreview) {
      if (isTile) {
        return (
          <div className="absolute inset-0 overflow-hidden">
            <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full p-2" style={{ opacity: opacity[0] / 100 }}>
              {Array(9).fill(0).map((_, i) => (
                <img key={i} src={imagePreview} alt="" className="w-full h-full object-contain" />
              ))}
            </div>
          </div>
        );
      }
      return (
        <img 
          src={imagePreview} 
          alt="Watermark" 
          className="max-w-[40%] max-h-[40%] object-contain"
          style={{ opacity: opacity[0] / 100 }}
        />
      );
    }
    
    if (isTile) {
      return (
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="grid grid-cols-2 grid-rows-3 gap-1 w-full h-full p-1 text-muted-foreground font-bold text-center"
            style={{ opacity: opacity[0] / 100, transform: `rotate(${rotation[0]}deg)` }}
          >
            {Array(6).fill(0).map((_, i) => (
              <span key={i} className="text-[8px] truncate">{text || 'Preview'}</span>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <span 
        className="text-muted-foreground font-bold select-none text-center px-2 max-w-full truncate"
        style={{
          opacity: opacity[0] / 100,
          transform: position === 'diagonal' ? `rotate(-45deg)` : `rotate(${rotation[0]}deg)`,
          fontSize: `${Math.max(8, fontSize[0] / 5)}px`,
        }}
      >
        {text || 'Preview'}
      </span>
    );
  };

  return (
    <ToolLayout
      title="Add Watermark"
      description="Stamp a text or image watermark across all pages of your PDF."
      icon={Droplets}
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
          buttonText="Select PDF"
          buttonTextWithFiles="Change PDF"
        />

        {files.length > 0 && (
          <>
            {/* PDF Preview */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                PDF Preview
              </Label>
              {loadingThumbnails ? (
                <div className="flex items-center justify-center h-32 bg-muted/50 rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {pageThumbnails.slice(0, 5).map((thumb, idx) => (
                    <div 
                      key={idx} 
                      className="relative flex-shrink-0 w-24 bg-card border border-border rounded-lg overflow-hidden"
                    >
                      <img src={thumb} alt={`Page ${idx + 1}`} className="w-full" />
                      {/* Watermark overlay preview */}
                      <div className="absolute inset-0">
                        {position === 'tile' ? (
                          renderWatermarkPreview(true)
                        ) : (
                          <div style={getPositionStyle(position)}>
                            {renderWatermarkPreview()}
                          </div>
                        )}
                      </div>
                      <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1 rounded">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                  {pageThumbnails.length > 5 && (
                    <div className="flex-shrink-0 w-24 flex items-center justify-center bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      +{pageThumbnails.length - 5} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Watermark Type Tabs */}
            <Tabs value={watermarkType} onValueChange={(v) => setWatermarkType(v as WatermarkType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="text">Watermark text</Label>
                  <Input
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter watermark text"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Font size</Label>
                    <span className="text-sm text-muted-foreground">{fontSize[0]}px</span>
                  </div>
                  <Slider
                    value={fontSize}
                    onValueChange={setFontSize}
                    min={20}
                    max={100}
                    step={5}
                  />
                </div>

                {position !== 'diagonal' && position !== 'tile' && (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Rotation</Label>
                      <span className="text-sm text-muted-foreground">{rotation[0]}°</span>
                    </div>
                    <Slider
                      value={rotation}
                      onValueChange={setRotation}
                      min={-90}
                      max={90}
                      step={15}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="image" className="space-y-4 mt-4">
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img 
                      src={imagePreview} 
                      alt="Watermark preview" 
                      className="max-h-24 rounded-lg border border-border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Label 
                      htmlFor="image-upload" 
                      className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Image className="h-6 w-6 text-muted-foreground mb-1" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                    </Label>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Image scale</Label>
                    <span className="text-sm text-muted-foreground">{imageScale[0]}%</span>
                  </div>
                  <Slider
                    value={imageScale}
                    onValueChange={setImageScale}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Shared Options */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Opacity</Label>
                  <span className="text-sm text-muted-foreground">{opacity[0]}%</span>
                </div>
                <Slider
                  value={opacity}
                  onValueChange={setOpacity}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>

              {/* Position Selector */}
              <div className="space-y-3">
                <Label>Position</Label>
                <div className="grid grid-cols-3 gap-2">
                  {/* 3x3 Grid for standard positions */}
                  {['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setPosition(pos as WatermarkPosition)}
                      className={cn(
                        "relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden",
                        position === pos 
                          ? "border-primary bg-primary/10" 
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      {/* Mini page lines */}
                      <div className="absolute inset-2 flex flex-col justify-center gap-1">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-0.5 bg-muted-foreground/20 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                        ))}
                      </div>
                      {/* Position dot */}
                      <div 
                        className={cn(
                          "absolute w-2 h-2 rounded-full transition-colors",
                          position === pos ? "bg-primary" : "bg-destructive"
                        )}
                        style={(() => {
                          const [v, h] = pos.split('-');
                          const top = v === 'top' ? '15%' : v === 'center' ? '50%' : '85%';
                          const left = h === 'left' ? '15%' : h === 'center' || !h ? '50%' : '85%';
                          return { top, left, transform: 'translate(-50%, -50%)' };
                        })()}
                      />
                    </button>
                  ))}
                </div>

                {/* Special positions */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPosition('diagonal')}
                    className={cn(
                      "flex-1 h-12 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm",
                      position === 'diagonal' 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <span className="transform -rotate-45">↗</span>
                    Diagonal
                  </button>
                  <button
                    onClick={() => setPosition('tile')}
                    className={cn(
                      "flex-1 h-12 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-sm",
                      position === 'tile' 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <div className="grid grid-cols-2 gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-sm bg-current" />
                      ))}
                    </div>
                    Tile
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleAddWatermark}
          disabled={files.length === 0 || (watermarkType === 'text' && !text.trim()) || (watermarkType === 'image' && !imageFile) || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Add Watermark & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default Watermark;
