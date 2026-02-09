import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { readFileAsArrayBuffer } from './pdf-core';

// Unlock PDF (remove password protection)
export const unlockPdf = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password,
    });

    const pdf = await loadingTask.promise;

    try {
      const newPdfDoc = await PDFDocument.create();

      for (let i = 1; i <= pdf.numPages; i++) {
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
      }

      return newPdfDoc.save();
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('password')) {
      throw new Error('Incorrect password');
    }
    throw error;
  }
};

// Protect PDF with password
// NOTE: pdf-lib does not support native PDF encryption.
// This re-renders pages as images and adds metadata markers.
// For true password encryption, a native desktop tool is required.
export const protectPdf = async (
  file: File,
  password: string,
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  try {
    const newPdfDoc = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      onPageProgress?.(i, numPages);

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
    }

    newPdfDoc.setTitle('Protected Document');
    newPdfDoc.setSubject('Password: Required');
    newPdfDoc.setKeywords(['protected', 'password-required']);

    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    newPdfDoc.setProducer(`PDF World (Protected: ${hashHex.substring(0, 16)})`);

    return newPdfDoc.save();
  } finally {
    pdf.destroy();
  }
};

// Redact PDF - permanently remove content by drawing black rectangles
export type RedactionArea = {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const redactPdf = async (
  file: File,
  redactions: RedactionArea[]
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const newPdfDoc = await PDFDocument.create();

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport, canvas }).promise;

      const pageRedactions = redactions.filter(r => r.pageIndex === i - 1);
      context.fillStyle = 'black';

      for (const redaction of pageRedactions) {
        const x = (redaction.x / 100) * canvas.width;
        const y = (redaction.y / 100) * canvas.height;
        const w = (redaction.width / 100) * canvas.width;
        const h = (redaction.height / 100) * canvas.height;
        context.fillRect(x, y, w, h);
      }

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
    }

    return newPdfDoc.save();
  } finally {
    pdf.destroy();
  }
};

// Compare two PDFs - creates side-by-side comparison
export const comparePdfs = async (
  file1: File,
  file2: File,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> => {
  const [arrayBuffer1, arrayBuffer2] = await Promise.all([
    readFileAsArrayBuffer(file1),
    readFileAsArrayBuffer(file2),
  ]);

  const [pdf1, pdf2] = await Promise.all([
    pdfjsLib.getDocument({ data: arrayBuffer1 }).promise,
    pdfjsLib.getDocument({ data: arrayBuffer2 }).promise,
  ]);

  try {
    const maxPages = Math.max(pdf1.numPages, pdf2.numPages);
    const newPdfDoc = await PDFDocument.create();
    const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 1; i <= maxPages; i++) {
      onProgress?.((i / maxPages) * 100);

      const scale = 1.5;

      let img1: Awaited<ReturnType<typeof newPdfDoc.embedJpg>> | null = null;
      let dim1 = { width: 300, height: 400 };
      if (i <= pdf1.numPages) {
        const page1 = await pdf1.getPage(i);
        const viewport1 = page1.getViewport({ scale });
        const canvas1 = document.createElement('canvas');
        const ctx1 = canvas1.getContext('2d');
        if (ctx1) {
          canvas1.width = viewport1.width;
          canvas1.height = viewport1.height;
          await page1.render({ canvasContext: ctx1, viewport: viewport1, canvas: canvas1 }).promise;
          const data1 = canvas1.toDataURL('image/jpeg', 0.85);
          const bytes1 = Uint8Array.from(atob(data1.split(',')[1]), c => c.charCodeAt(0));
          img1 = await newPdfDoc.embedJpg(bytes1);
          const origVp = page1.getViewport({ scale: 1 });
          dim1 = { width: origVp.width, height: origVp.height };
        }
      }

      let img2: Awaited<ReturnType<typeof newPdfDoc.embedJpg>> | null = null;
      let dim2 = { width: 300, height: 400 };
      if (i <= pdf2.numPages) {
        const page2 = await pdf2.getPage(i);
        const viewport2 = page2.getViewport({ scale });
        const canvas2 = document.createElement('canvas');
        const ctx2 = canvas2.getContext('2d');
        if (ctx2) {
          canvas2.width = viewport2.width;
          canvas2.height = viewport2.height;
          await page2.render({ canvasContext: ctx2, viewport: viewport2, canvas: canvas2 }).promise;
          const data2 = canvas2.toDataURL('image/jpeg', 0.85);
          const bytes2 = Uint8Array.from(atob(data2.split(',')[1]), c => c.charCodeAt(0));
          img2 = await newPdfDoc.embedJpg(bytes2);
          const origVp = page2.getViewport({ scale: 1 });
          dim2 = { width: origVp.width, height: origVp.height };
        }
      }

      const gap = 30;
      const headerHeight = 30;
      const pageWidth = dim1.width + dim2.width + gap * 3;
      const pageHeight = Math.max(dim1.height, dim2.height) + headerHeight + gap * 2;

      const newPage = newPdfDoc.addPage([pageWidth, pageHeight]);

      newPage.drawText('Original', {
        x: gap + dim1.width / 2 - 25,
        y: pageHeight - 20,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      newPage.drawText('Modified', {
        x: gap * 2 + dim1.width + dim2.width / 2 - 25,
        y: pageHeight - 20,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      if (img1) {
        newPage.drawImage(img1, { x: gap, y: gap, width: dim1.width, height: dim1.height });
      } else {
        newPage.drawText('No page', {
          x: gap + dim1.width / 2 - 25,
          y: gap + dim1.height / 2,
          size: 14,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      if (img2) {
        newPage.drawImage(img2, { x: gap * 2 + dim1.width, y: gap, width: dim2.width, height: dim2.height });
      } else {
        newPage.drawText('No page', {
          x: gap * 2 + dim1.width + dim2.width / 2 - 25,
          y: gap + dim2.height / 2,
          size: 14,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      newPage.drawLine({
        start: { x: gap + dim1.width + gap / 2, y: gap },
        end: { x: gap + dim1.width + gap / 2, y: pageHeight - headerHeight - gap },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    }

    return newPdfDoc.save();
  } finally {
    pdf1.destroy();
    pdf2.destroy();
  }
};
