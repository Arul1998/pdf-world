import { useState } from 'react';
import { Presentation, Download, Loader2, Trash2, Archive } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFFile } from '@/lib/pdf-tools';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const PdfToPpt = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [outputFormat, setOutputFormat] = useState<'images' | 'pptx'>('pptx');
  const [currentFile, setCurrentFile] = useState<string>('');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const createPptxFromImages = async (images: { data: string; width: number; height: number }[], fileName: string): Promise<Blob> => {
    // Create a simple PPTX using JSZip
    const zip = new JSZip();
    
    // Content Types
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${images.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
</Types>`;
    zip.file('[Content_Types].xml', contentTypes);
    
    // Relationships
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
    zip.file('_rels/.rels', rels);
    
    // Presentation relationships
    const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${images.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('\n  ')}
  <Relationship Id="rId${images.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`;
    zip.file('ppt/_rels/presentation.xml.rels', presentationRels);
    
    // Presentation
    const slideWidth = 9144000; // EMUs (914400 per inch)
    const slideHeight = 6858000;
    const presentation = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId${images.length + 1}"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${images.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('\n    ')}
  </p:sldIdLst>
  <p:sldSz cx="${slideWidth}" cy="${slideHeight}"/>
  <p:notesSz cx="${slideHeight}" cy="${slideWidth}"/>
</p:presentation>`;
    zip.file('ppt/presentation.xml', presentation);
    
    // Slide Master
    const slideMaster = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
    zip.file('ppt/slideMasters/slideMaster1.xml', slideMaster);
    
    const slideMasterRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels);
    
    // Slide Layout
    const slideLayout = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;
    zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayout);
    
    const slideLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels);
    
    // Create slides with images
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgData = img.data.split(',')[1];
      const imgExt = img.data.includes('image/png') ? 'png' : 'jpeg';
      
      // Save image
      zip.file(`ppt/media/image${i + 1}.${imgExt}`, imgData, { base64: true });
      
      // Slide relationships
      const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.${imgExt}"/>
</Relationships>`;
      zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, slideRels);
      
      // Slide content
      const slide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Image ${i + 1}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId2"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="${slideWidth}" cy="${slideHeight}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;
      zip.file(`ppt/slides/slide${i + 1}.xml`, slide);
    }
    
    return zip.generateAsync({ type: 'blob' });
  };

  const convertPdfToPpt = async (file: File): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const images: { data: string; width: number; height: number }[] = [];
    
    for (let i = 1; i <= totalPages; i++) {
      setProgressMessage(`Rendering page ${i}/${totalPages}...`);
      setProgress((i / totalPages) * 70);
      
      const page = await pdf.getPage(i);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      images.push({
        data: canvas.toDataURL('image/jpeg', 0.9),
        width: viewport.width,
        height: viewport.height,
      });
    }
    
    setProgressMessage('Creating PowerPoint...');
    setProgress(85);
    
    return createPptxFromImages(images, file.name);
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        setCurrentFile(files[0].name);
        const pptBlob = await convertPdfToPpt(files[0].file);
        setProgress(100);
        
        saveAs(pptBlob, files[0].name.replace('.pdf', '.pptx'));
        toast.success('PDF converted to PowerPoint!');
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          
          try {
            const pptBlob = await convertPdfToPpt(file.file);
            const pptName = file.name.replace('.pdf', '.pptx');
            zip.file(pptName, pptBlob);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
          }
        }
        
        setProgressMessage('Creating ZIP archive...');
        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `pdf-to-ppt_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Converted ${files.length} files!`);
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert PDF');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="PDF to PowerPoint"
      description="Convert PDF documents to PowerPoint presentations with each page as a slide."
      icon={Presentation}
      category="convert-from"
      categoryColor="convert-from"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple
          hideFileList
          buttonText="Select PDF Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{files.length} file(s) selected</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="grid gap-2 max-h-40 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            <p className="text-sm text-center text-muted-foreground">
              {currentFile && `${currentFile}: `}{progressMessage}
            </p>
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
          ) : files.length > 1 ? (
            <>
              <Archive className="mr-2 h-5 w-5" />
              Convert All & Download ZIP
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PowerPoint
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Each PDF page becomes a slide with the page rendered as an image.
        </p>
      </div>
    </ToolLayout>
  );
};

export default PdfToPpt;
