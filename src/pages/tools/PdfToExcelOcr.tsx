import { useState } from 'react';
import { FileSearch, Download, Loader2, Trash2, Languages, Archive } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { PDFFile } from '@/lib/pdf-tools';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
];

const PdfToExcelOcr = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [language, setLanguage] = useState('eng');
  const [currentFile, setCurrentFile] = useState<string>('');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const convertPdfToExcel = async (file: File, lang: string): Promise<ArrayBuffer> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    
    const workbook = XLSX.utils.book_new();
    
    for (let i = 1; i <= totalPages; i++) {
      setProgressMessage(`OCR processing page ${i}/${totalPages}...`);
      setProgress((i / totalPages) * 80);
      
      const page = await pdf.getPage(i);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      // Perform OCR
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      
      const result = await Tesseract.recognize(blob, lang, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pageProgress = (i - 1) / totalPages * 80;
            const ocrProgress = (m.progress || 0) / totalPages * 80;
            setProgress(pageProgress + ocrProgress);
          }
        },
      });
      
      // Parse text into rows (split by newlines, then by tabs/multiple spaces)
      const lines = result.data.text.split('\n').filter(line => line.trim());
      const rows: string[][] = lines.map(line => {
        // Split by tabs first, then by multiple spaces
        return line.split(/\t|\s{2,}/).map(cell => cell.trim()).filter(cell => cell);
      });
      
      // Create worksheet for this page
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const sheetName = `Page ${i}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
    
    setProgressMessage('Creating Excel file...');
    setProgress(90);
    
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
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
        const excelData = await convertPdfToExcel(files[0].file, language);
        setProgress(100);
        
        const blob = new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, files[0].name.replace('.pdf', '_ocr.xlsx'));
        toast.success('PDF converted to Excel with OCR!');
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          
          try {
            const excelData = await convertPdfToExcel(file.file, language);
            const excelName = file.name.replace('.pdf', '_ocr.xlsx');
            zip.file(excelName, excelData);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
          }
        }
        
        setProgressMessage('Creating ZIP archive...');
        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `pdf-to-excel-ocr_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Converted ${files.length} files with OCR!`);
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
      title="PDF to Excel (OCR)"
      description="Convert scanned PDF tables to Excel spreadsheets using optical character recognition."
      icon={FileSearch}
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
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Document Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCR_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the primary language for better OCR accuracy.
                </p>
              </div>
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
              Converting with OCR...
            </>
          ) : files.length > 1 ? (
            <>
              <Archive className="mr-2 h-5 w-5" />
              Convert All & Download ZIP
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert with OCR
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Best for scanned documents with tables. Each page creates a separate sheet.
        </p>
      </div>
    </ToolLayout>
  );
};

export default PdfToExcelOcr;
