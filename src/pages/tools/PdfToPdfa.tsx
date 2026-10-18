import { useState } from 'react';
import { FileCheck, Download, Loader2, Trash2, Archive, Info } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFFile } from '@/lib/pdf-tools';
import { convertToPdfA, type PdfALevel } from '@/lib/pdf/pdf-pdfa';

const PDFA_LEVELS = [
  { id: 'pdfa-1b', name: 'PDF/A-1b', description: 'Basic conformance, most compatible' },
  { id: 'pdfa-2b', name: 'PDF/A-2b', description: 'Better compression, JPEG2000 support' },
  { id: 'pdfa-3b', name: 'PDF/A-3b', description: 'Allows embedded files' },
];

const PdfToPdfa = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [pdfaLevel, setPdfaLevel] = useState<PdfALevel>('pdfa-2b');
  const [currentFile, setCurrentFile] = useState<string>('');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const convertToPdfa = (file: File, level: PdfALevel): Promise<Uint8Array> =>
    convertToPdfA(file, level, (page, total) => {
      setProgressMessage(`Converting page ${page}/${total}...`);
      setProgress((page / total) * 90);
    });

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
        const pdfaData = await convertToPdfa(files[0].file, pdfaLevel);
        setProgress(100);
        
        const blob = new Blob([new Uint8Array(pdfaData)], { type: 'application/pdf' });
        saveAs(blob, files[0].name.replace(/\.pdf$/i, '') + `_${pdfaLevel}.pdf`);
        toast.success(`Converted to ${pdfaLevel.toUpperCase()}!`);
      } else {
        const zip = new JSZip();
        const failed: string[] = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          
          try {
            const pdfaData = await convertToPdfa(file.file, pdfaLevel);
            const pdfaName = file.name.replace(/\.pdf$/i, '') + `_${pdfaLevel}.pdf`;
            zip.file(pdfaName, pdfaData);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
            failed.push(file.name);
          }
        }

        if (failed.length === files.length) {
          throw new Error('All files failed to convert');
        }
        
        setProgressMessage('Creating ZIP archive...');
        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `pdf-to-pdfa_${new Date().toISOString().split('T')[0]}.zip`);
        const converted = files.length - failed.length;
        toast.success(`Converted ${converted} files to ${pdfaLevel.toUpperCase()}!`);
        if (failed.length > 0) {
          toast.error(`Could not convert: ${failed.join(', ')}`);
        }
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert to PDF/A');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="PDF to PDF/A"
      description="Convert PDF to PDF/A archival format for long-term document preservation."
      icon={FileCheck}
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
          <>
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
            
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <Label>PDF/A Conformance Level</Label>
              <RadioGroup value={pdfaLevel} onValueChange={(v) => setPdfaLevel(v as PdfALevel)}>
                {PDFA_LEVELS.map((level) => (
                  <div key={level.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor={level.id} className="font-medium cursor-pointer">
                        {level.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">{level.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                PDF/A is an ISO-standardized format designed for long-term archival of electronic documents.
                To guarantee conformance, each page is converted to a high-resolution image, so text in the
                output will not be selectable or searchable. Run OCR afterwards if you need searchable text.
              </p>
            </div>
          </>
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
              Convert to PDF/A
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default PdfToPdfa;
