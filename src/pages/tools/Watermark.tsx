import { useState, useEffect } from 'react';
import { Droplets, Download, Loader2, Image, Type, X, FileText, Bold, Italic, Underline, Layers } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { addWatermark, downloadBlob, generatePdfPageThumbnails, type PDFFile, type WatermarkPosition } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

type WatermarkType = 'text' | 'image';
type LayerType = 'over' | 'below';

const TRANSPARENCY_OPTIONS = [
  { value: '100', label: 'No transparency' },
  { value: '75', label: '25% transparent' },
  { value: '50', label: '50% transparent' },
  { value: '25', label: '75% transparent' },
  { value: '10', label: '90% transparent' },
];

const ROTATION_OPTIONS = [
  { value: '0', label: 'Do not rotate' },
  { value: '45', label: '45°' },
  { value: '90', label: '90°' },
  { value: '-45', label: '-45°' },
  { value: '-90', label: '-90°' },
];

const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Arial' },
  { value: 'Times-Roman', label: 'Times' },
  { value: 'Courier', label: 'Courier' },
];

const FONT_SIZE_OPTIONS = [
  { value: '20', label: 'Small' },
  { value: '40', label: 'Medium' },
  { value: '60', label: 'Large' },
  { value: '80', label: 'Extra Large' },
];

const Watermark = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [watermarkType, setWatermarkType] = useState<WatermarkType>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [transparency, setTransparency] = useState('50');
  const [rotation, setRotation] = useState('0');
  const [fontSize, setFontSize] = useState('40');
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [position, setPosition] = useState<WatermarkPosition>('top-left');
  const [isMosaic, setIsMosaic] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState([30]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [layer, setLayer] = useState<LayerType>('over');
  const [totalPages, setTotalPages] = useState(1);

  // Generate thumbnails when PDF is loaded
  useEffect(() => {
    if (files.length > 0) {
      setLoadingThumbnails(true);
      generatePdfPageThumbnails(files[0].file, 0.4)
        .then((thumbnails) => {
          setPageThumbnails(thumbnails);
          setTotalPages(thumbnails.length);
          setToPage(thumbnails.length);
        })
        .finally(() => setLoadingThumbnails(false));
    } else {
      setPageThumbnails([]);
      setTotalPages(1);
      setFromPage(1);
      setToPage(1);
    }
  }, [files]);

  // Handle mosaic toggle
  useEffect(() => {
    if (isMosaic) {
      setPosition('tile');
    } else if (position === 'tile') {
      setPosition('top-left');
    }
  }, [isMosaic]);

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
      const effectivePosition = isMosaic ? 'tile' : position;
      const result = await addWatermark(
        files[0].file, 
        watermarkType === 'text' ? text : '',
        {
          opacity: parseInt(transparency) / 100,
          rotation: parseInt(rotation),
          fontSize: parseInt(fontSize),
          position: effectivePosition,
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

  const renderWatermarkPreview = (isTileMode: boolean = false) => {
    const opacityValue = parseInt(transparency) / 100;
    const rotationValue = parseInt(rotation);
    
    if (watermarkType === 'image' && imagePreview) {
      if (isTileMode) {
        return (
          <div className="absolute inset-0 overflow-hidden">
            <div className="grid grid-cols-3 grid-rows-3 gap-2 w-full h-full p-2" style={{ opacity: opacityValue }}>
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
          style={{ opacity: opacityValue }}
        />
      );
    }
    
    if (isTileMode) {
      return (
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="grid grid-cols-2 grid-rows-3 gap-1 w-full h-full p-1 text-muted-foreground font-bold text-center"
            style={{ opacity: opacityValue, transform: `rotate(${rotationValue}deg)` }}
          >
            {Array(6).fill(0).map((_, i) => (
              <span 
                key={i} 
                className={cn(
                  "text-[8px] truncate",
                  isBold && "font-bold",
                  isItalic && "italic"
                )}
              >
                {text || 'Preview'}
              </span>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <span 
        className={cn(
          "text-muted-foreground select-none text-center px-2 max-w-full truncate",
          isBold && "font-bold",
          isItalic && "italic",
          isUnderline && "underline"
        )}
        style={{
          opacity: opacityValue,
          transform: position === 'diagonal' ? `rotate(-45deg)` : `rotate(${rotationValue}deg)`,
          fontSize: `${Math.max(8, parseInt(fontSize) / 5)}px`,
        }}
      >
        {text || 'Preview'}
      </span>
    );
  };

  const effectivePosition = isMosaic ? 'tile' : position;

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
                        {effectivePosition === 'tile' ? (
                          renderWatermarkPreview(true)
                        ) : (
                          <div style={getPositionStyle(effectivePosition)}>
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
                {/* Text Input */}
                <div className="space-y-2">
                  <Label htmlFor="text">Text:</Label>
                  <Input
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter watermark text"
                  />
                </div>

                {/* Text Format Toolbar */}
                <div className="space-y-2">
                  <Label>Text format:</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={fontSize} onValueChange={setFontSize}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setIsBold(!isBold)}
                        className={cn(
                          "p-2 hover:bg-muted transition-colors",
                          isBold && "bg-primary text-primary-foreground"
                        )}
                        title="Bold"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIsItalic(!isItalic)}
                        className={cn(
                          "p-2 hover:bg-muted transition-colors border-l border-border",
                          isItalic && "bg-primary text-primary-foreground"
                        )}
                        title="Italic"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setIsUnderline(!isUnderline)}
                        className={cn(
                          "p-2 hover:bg-muted transition-colors border-l border-border",
                          isUnderline && "bg-primary text-primary-foreground"
                        )}
                        title="Underline"
                      >
                        <Underline className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
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
                  <Button
                    variant="outline"
                    className="w-full h-14 border-dashed flex items-center gap-2 text-primary hover:text-primary"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <Image className="h-5 w-5" />
                    ADD IMAGE
                  </Button>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

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

            {/* Position Section */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
              <div className="space-y-3">
                <Label>Position:</Label>
                <div className="flex items-start gap-4">
                  {/* 3x3 Position Grid */}
                  <div className="grid grid-cols-3 gap-1 p-2 border border-border rounded-lg bg-card">
                    {['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                      <button
                        key={pos}
                        onClick={() => {
                          setPosition(pos as WatermarkPosition);
                          setIsMosaic(false);
                        }}
                        disabled={isMosaic}
                        className={cn(
                          "w-6 h-6 rounded transition-all flex items-center justify-center",
                          !isMosaic && position === pos 
                            ? "bg-destructive" 
                            : "bg-muted hover:bg-muted-foreground/20",
                          isMosaic && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div 
                          className={cn(
                            "w-2 h-2 rounded-full",
                            !isMosaic && position === pos ? "bg-destructive-foreground" : "bg-muted-foreground/40"
                          )}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Mosaic Checkbox */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="mosaic"
                      checked={isMosaic}
                      onCheckedChange={(checked) => setIsMosaic(checked === true)}
                    />
                    <Label htmlFor="mosaic" className="cursor-pointer">Mosaic</Label>
                  </div>
                </div>
              </div>

              {/* Transparency & Rotation Dropdowns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transparency:</Label>
                  <Select value={transparency} onValueChange={setTransparency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPARENCY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rotation:</Label>
                  <Select value={rotation} onValueChange={setRotation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROTATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pages Range */}
              <div className="space-y-2">
                <Label>Pages:</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">from page</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={fromPage}
                    onChange={(e) => setFromPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                    className="w-16 text-center"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="number"
                    min={fromPage}
                    max={totalPages}
                    value={toPage}
                    onChange={(e) => setToPage(Math.max(fromPage, Math.min(totalPages, parseInt(e.target.value) || totalPages)))}
                    className="w-16 text-center"
                  />
                </div>
              </div>

              {/* Layer Selection */}
              <div className="space-y-2">
                <Label>Layer</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLayer('over')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      layer === 'over' 
                        ? "border-primary bg-primary/5 text-primary" 
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <Layers className="h-6 w-6" />
                    <span className="text-sm font-medium">Over the PDF content</span>
                  </button>
                  <button
                    onClick={() => setLayer('below')}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      layer === 'below' 
                        ? "border-primary bg-primary/5 text-primary" 
                        : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <Layers className="h-6 w-6 opacity-50" />
                    <span className="text-sm font-medium">Below the PDF content</span>
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
