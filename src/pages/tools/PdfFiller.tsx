import { useState, useEffect, useCallback } from 'react';
import { FileEdit, Download, ChevronLeft, ChevronRight, AlertTriangle, Type, CheckSquare } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { downloadBlob, type PDFFile } from '@/lib/pdf-tools';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface FormField {
  id: string;
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button';
  value: string;
  checked?: boolean;
  options?: string[];
  page: number;
  rect?: { x: number; y: number; width: number; height: number };
}

const PdfFiller = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [pagePreview, setPagePreview] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasFields, setHasFields] = useState(true);

  // Load PDF and extract form fields
  const loadPdf = useCallback(async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();
      const fields = form.getFields();
      
      setProgress(30);

      const extractedFields: FormField[] = [];

      fields.forEach((field, index) => {
        const fieldName = field.getName();
        const fieldType = field.constructor.name;

        let formField: FormField = {
          id: `field-${index}`,
          name: fieldName || `Field ${index + 1}`,
          type: 'text',
          value: '',
          page: 0,
        };

        try {
          if (fieldType === 'PDFTextField') {
            const textField = form.getTextField(fieldName);
            formField.type = 'text';
            formField.value = textField.getText() || '';
          } else if (fieldType === 'PDFCheckBox') {
            const checkBox = form.getCheckBox(fieldName);
            formField.type = 'checkbox';
            formField.checked = checkBox.isChecked();
          } else if (fieldType === 'PDFRadioGroup') {
            const radioGroup = form.getRadioGroup(fieldName);
            formField.type = 'radio';
            formField.value = radioGroup.getSelected() || '';
            formField.options = radioGroup.getOptions();
          } else if (fieldType === 'PDFDropdown') {
            const dropdown = form.getDropdown(fieldName);
            formField.type = 'dropdown';
            formField.value = dropdown.getSelected().join(', ');
            formField.options = dropdown.getOptions();
          } else if (fieldType === 'PDFButton') {
            formField.type = 'button';
          }
        } catch (err) {
          console.warn(`Could not read field ${fieldName}:`, err);
        }

        if (formField.type !== 'button') {
          extractedFields.push(formField);
        }
      });

      setFormFields(extractedFields);
      setHasFields(extractedFields.length > 0);
      setProgress(50);

      // Load preview using pdfjs
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
      await renderPage(pdf, 1);
      
      setProgress(100);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Failed to load PDF');
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  const renderPage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdf.getPage(pageNum);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    setPagePreview(canvas.toDataURL());
    setCurrentPage(pageNum - 1);
  };

  useEffect(() => {
    if (files.length > 0) {
      loadPdf();
    } else {
      setFormFields([]);
      setPagePreview('');
      setTotalPages(0);
      setHasFields(true);
    }
  }, [files, loadPdf]);

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFormFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        if (field.type === 'checkbox') {
          return { ...field, checked: value as boolean };
        }
        return { ...field, value: value as string };
      }
      return field;
    }));
  };

  const changePage = async (delta: number) => {
    if (!files[0]) return;
    const newPage = Math.max(0, Math.min(totalPages - 1, currentPage + delta));
    if (newPage !== currentPage) {
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      await renderPage(pdf, newPage + 1);
    }
  };

  const fillAndDownload = async () => {
    if (!files[0]) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const form = pdfDoc.getForm();

      setProgress(30);

      formFields.forEach((field, index) => {
        try {
          if (field.type === 'text') {
            const textField = form.getTextField(field.name);
            textField.setText(field.value);
          } else if (field.type === 'checkbox') {
            const checkBox = form.getCheckBox(field.name);
            if (field.checked) {
              checkBox.check();
            } else {
              checkBox.uncheck();
            }
          } else if (field.type === 'radio' && field.value) {
            const radioGroup = form.getRadioGroup(field.name);
            radioGroup.select(field.value);
          } else if (field.type === 'dropdown' && field.value) {
            const dropdown = form.getDropdown(field.name);
            dropdown.select(field.value);
          }
        } catch (err) {
          console.warn(`Could not fill field ${field.name}:`, err);
        }
        setProgress(30 + ((index + 1) / formFields.length) * 50);
      });

      // Flatten form to make it non-editable (optional)
      // form.flatten();

      setProgress(90);

      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Uint8Array(pdfBytes), files[0].file.name.replace('.pdf', '-filled.pdf'));

      setProgress(100);
      toast.success('Filled PDF downloaded successfully!');
    } catch (error) {
      console.error('Error filling PDF:', error);
      toast.error('Failed to fill PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setFormFields([]);
    setPagePreview('');
    setTotalPages(0);
    setCurrentPage(0);
    setHasFields(true);
  };

  return (
    <ToolLayout
      title="PDF Filler"
      description="Fill out PDF forms by detecting fields and entering values"
      icon={FileEdit}
      category="Edit PDF"
      categoryColor="edit"
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {files.length === 0 ? (
          <FileDropZone
            accept={['.pdf']}
            maxFiles={1}
            files={files}
            onFilesChange={setFiles}
          />
        ) : isProcessing && formFields.length === 0 ? (
          <div className="text-center py-12">
            <ProgressBar progress={progress} />
            <p className="mt-4 text-muted-foreground">Analyzing PDF form...</p>
          </div>
        ) : !hasFields ? (
          <div className="text-center py-12 space-y-4">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500" />
            <h3 className="text-xl font-semibold">No Form Fields Detected</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              This PDF doesn't contain fillable form fields. You can use the{' '}
              <a href="/tools/edit-pdf" className="text-primary underline">Edit PDF</a>{' '}
              tool to add text annotations instead.
            </p>
            <Button onClick={reset} variant="outline">
              Try Another PDF
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form Fields Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Form Fields ({formFields.length})
                </h3>
              </div>

              <ScrollArea className="h-[500px] rounded-lg border p-4">
                <div className="space-y-4">
                  {formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="text-sm font-medium">
                        {field.name}
                      </Label>
                      
                      {field.type === 'text' && (
                        <Input
                          id={field.id}
                          value={field.value}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          placeholder={`Enter ${field.name}`}
                        />
                      )}

                      {field.type === 'checkbox' && (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={field.id}
                            checked={field.checked}
                            onCheckedChange={(checked) => handleFieldChange(field.id, !!checked)}
                          />
                          <Label htmlFor={field.id} className="text-sm text-muted-foreground">
                            {field.checked ? 'Checked' : 'Unchecked'}
                          </Label>
                        </div>
                      )}

                      {field.type === 'radio' && field.options && (
                        <div className="space-y-2">
                          {field.options.map((option) => (
                            <div key={option} className="flex items-center gap-2">
                              <input
                                type="radio"
                                id={`${field.id}-${option}`}
                                name={field.id}
                                value={option}
                                checked={field.value === option}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                className="h-4 w-4"
                              />
                              <Label htmlFor={`${field.id}-${option}`} className="text-sm">
                                {option}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'dropdown' && field.options && (
                        <select
                          id={field.id}
                          value={field.value}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">Select an option</option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}

                  {formFields.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Loading form fields...
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-3">
                <Button onClick={fillAndDownload} disabled={isProcessing} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download Filled PDF
                </Button>
                <Button onClick={reset} variant="outline">
                  Reset
                </Button>
              </div>

              {isProcessing && (
                <ProgressBar progress={progress} />
              )}
            </div>

            {/* PDF Preview Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Preview</h3>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(-1)}
                      disabled={currentPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(1)}
                      disabled={currentPage >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden bg-muted/20">
                {pagePreview ? (
                  <img
                    src={pagePreview}
                    alt={`Page ${currentPage + 1}`}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                    Loading preview...
                  </div>
                )}
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-start gap-3">
                  <CheckSquare className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Fill out the form fields on the left</p>
                    <p className="text-muted-foreground">
                      The values you enter will be embedded into the PDF when you download.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default PdfFiller;
