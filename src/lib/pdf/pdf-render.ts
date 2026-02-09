import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
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

// Render PDF pages at higher scale for preview
export const renderPdfPages = async (
  file: File,
  scale: number = 1.0
): Promise<{ dataUrl: string; width: number; height: number }[]> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    try {
      const pages: { dataUrl: string; width: number; height: number }[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          pages.push({ dataUrl: '', width: 0, height: 0 });
          continue;
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        pages.push({
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: viewport.width,
          height: viewport.height,
        });
      }

      return pages;
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    console.error('Failed to render PDF pages:', error);
    return [];
  }
};
