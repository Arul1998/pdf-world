import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { readFileAsArrayBuffer } from './pdf-core';

// Compress PDF by re-rendering pages as images at specified quality
export const compressPdf = async (
  file: File,
  level: 'maximum' | 'balanced' | 'minimum' = 'balanced',
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const qualityMap = {
    maximum: 0.4,
    balanced: 0.65,
    minimum: 0.85,
  };

  const scaleMap = {
    maximum: 1.0,
    balanced: 1.5,
    minimum: 2.0,
  };

  const quality = qualityMap[level];
  const scale = scaleMap[level];

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  try {
    const newPdfDoc = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      onPageProgress?.(i, numPages);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));

      const jpgImage = await newPdfDoc.embedJpg(imageBytes);

      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);

      newPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
    }

    return newPdfDoc.save({ useObjectStreams: true });
  } finally {
    pdf.destroy();
  }
};

// Repair PDF
export interface RepairResult {
  data: Uint8Array;
  originalPageCount: number;
  repairedPageCount: number;
  issuesFound: string[];
  issuesFixed: string[];
}

export const repairPdf = async (
  file: File,
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<RepairResult> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const issuesFound: string[] = [];
  const issuesFixed: string[] = [];
  let originalPageCount = 0;

  try {
    try {
      const testDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      originalPageCount = testDoc.getPageCount();
    } catch {
      issuesFound.push('PDF structure is corrupted');
    }

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0,
    }).promise;

    try {
      if (originalPageCount === 0) {
        originalPageCount = pdf.numPages;
      }

      if (pdf.numPages !== originalPageCount) {
        issuesFound.push('Page count mismatch detected');
      }

      const newPdfDoc = await PDFDocument.create();
      let successfulPages = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        onPageProgress?.(i, pdf.numPages);

        try {
          const page = await pdf.getPage(i);
          const scale = 2;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport, canvas }).promise;

          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
          const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));

          const jpgImage = await newPdfDoc.embedJpg(imageBytes);

          const originalViewport = page.getViewport({ scale: 1 });
          const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);

          newPage.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width: originalViewport.width,
            height: originalViewport.height,
          });

          successfulPages++;
        } catch (pageError) {
          console.error(`Failed to repair page ${i}:`, pageError);
          issuesFound.push(`Page ${i} was corrupted`);
        }
      }

      if (issuesFound.length > 0) {
        issuesFixed.push('Reconstructed document structure');
        issuesFixed.push(`Successfully recovered ${successfulPages} of ${originalPageCount} pages`);
      }

      const repairedData = await newPdfDoc.save();

      return {
        data: repairedData,
        originalPageCount,
        repairedPageCount: successfulPages,
        issuesFound,
        issuesFixed,
      };
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    console.error('Repair failed:', error);
    throw new Error('Unable to repair PDF - file may be too corrupted');
  }
};

// OCR PDF
export interface OcrResult {
  pdfData: Uint8Array;
  text: string;
  pageCount: number;
}

export const ocrPdf = async (
  file: File,
  language: string = 'eng',
  onProgress?: (currentPage: number, totalPages: number, status?: string) => void
): Promise<OcrResult> => {
  const { createWorker } = await import('tesseract.js');

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  onProgress?.(0, numPages, 'Loading OCR engine...');
  const worker = await createWorker(language);

  const newPdfDoc = await PDFDocument.create();
  const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
  let allText = '';

  try {
    for (let i = 1; i <= numPages; i++) {
      onProgress?.(i, numPages, `Processing page ${i} of ${numPages}...`);

      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const imageData = canvas.toDataURL('image/png');
      const { data } = await worker.recognize(imageData);
      const pageText = data.text;
      allText += `--- Page ${i} ---\n${pageText}\n\n`;

      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);

      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
      const jpgImage = await newPdfDoc.embedJpg(imageBytes);

      newPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });

      const fontSize = 10;
      const blocks = data.blocks || [];
      for (const block of blocks) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              if (!word.text.trim()) continue;

              const scaleRatio = originalViewport.width / viewport.width;
              const x = word.bbox.x0 * scaleRatio;
              const y = originalViewport.height - (word.bbox.y1 * scaleRatio);

              try {
                newPage.drawText(word.text, {
                  x,
                  y,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                  opacity: 0,
                });
              } catch {
                // Skip words with unsupported characters
              }
            }
          }
        }
      }
    }

    onProgress?.(numPages, numPages, 'Finalizing PDF...');
    const pdfData = await newPdfDoc.save();

    return {
      pdfData,
      text: allText,
      pageCount: numPages,
    };
  } finally {
    await worker.terminate();
    pdf.destroy();
  }
};
