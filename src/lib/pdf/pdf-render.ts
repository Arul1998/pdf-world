import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from './pdfjs-setup';
import { readFileAsArrayBuffer } from './pdf-core';

export const getPdfPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  return pdfDoc.getPageCount();
};

export const generatePdfThumbnail = async (file: File, timeoutMs: number = 4000): Promise<string> => {
  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('Thumbnail generation timeout')), timeoutMs);
  });

  const generatePromise = (async () => {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    try {
      const page = await pdf.getPage(1);

      const scale = 0.25;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      return canvas.toDataURL('image/jpeg', 0.5);
    } finally {
      pdf.destroy();
    }
  })();

  try {
    return await Promise.race([generatePromise, timeoutPromise]);
  } catch (error) {
    console.warn('Thumbnail generation failed or timed out:', error);
    return '';
  }
};

export const generatePdfPageThumbnails = async (file: File, scale: number = 0.3): Promise<string[]> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    try {
      const thumbnails: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          thumbnails.push('');
          continue;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.7));
      }

      return thumbnails;
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    console.error('Failed to generate page thumbnails:', error);
    return [];
  }
};

export interface PdfRenderLimits {
  maxPages: number;
  maxPagePixels: number;
  maxTotalPixels: number;
}
export const REDACTION_RENDER_LIMITS: PdfRenderLimits = {
  maxPages: 100, maxPagePixels: 16_000_000, maxTotalPixels: 64_000_000,
};

// Render PDF pages at higher scale for preview. Security-sensitive callers
// supply limits and receive errors instead of silently accepting missing pages.
export const renderPdfPages = async (
  file: File,
  scale: number = 1.0,
  limits?: PdfRenderLimits
): Promise<{ dataUrl: string; width: number; height: number }[]> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const task = pdfjsLib.getDocument({ data: arrayBuffer });
    try {
      const pdf = await task.promise;
      if (limits && (pdf.numPages < 1 || pdf.numPages > limits.maxPages)) throw new Error(`Preview is limited to ${limits.maxPages} pages.`);
      const pages: { dataUrl: string; width: number; height: number }[] = [];
      let totalPixels = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const canvas = document.createElement('canvas');
        try {
          const viewport = page.getViewport({ scale });
          const width = Math.ceil(viewport.width);
          const height = Math.ceil(viewport.height);
          const pixels = width * height;
          totalPixels += pixels;
          if (limits && (![width, height].every(v => Number.isFinite(v) && v > 0) || pixels > limits.maxPagePixels || totalPixels > limits.maxTotalPixels)) {
            throw new Error('This PDF is too large to preview safely. Use a smaller document.');
          }
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            if (limits) throw new Error('Unable to create a preview canvas.');
            pages.push({ dataUrl: '', width: 0, height: 0 });
            continue;
          }
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          pages.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      }
      return pages;
    } finally {
      await task.destroy();
    }
  } catch (error) {
    if (limits) throw error;
    console.error('Failed to render PDF pages:', error);
    return [];
  }
};
