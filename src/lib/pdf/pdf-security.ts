import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// @cantoo/pdf-lib is a drop-in pdf-lib fork that adds real (AES) PDF encryption
// and decryption. We use it only for the password tools so the rest of the app
// keeps using the mainline pdf-lib build.
import { PDFDocument as SecurePDFDocument } from '@cantoo/pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { readFileAsArrayBuffer } from './pdf-core';

// Unlock PDF (remove password protection).
// Preferred path: decrypt with the real password and re-save without encryption,
// which keeps text, fonts and vectors intact. If pdf-lib can't parse the file
// (its decryption support is narrower than pdf.js), fall back to rasterising the
// rendered pages so the user still gets an openable, unprotected document.
export const unlockPdf = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // 1) Try a true, content-preserving decrypt. Note: re-saving a document that
  //    was loaded with a password keeps its encryption, so we copy the pages
  //    into a fresh, unencrypted document to actually strip the protection.
  try {
    const locked = await SecurePDFDocument.load(arrayBuffer, { password });
    const out = await SecurePDFDocument.create();
    const pages = await out.copyPages(locked, locked.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    return await out.save();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    // A wrong password is a user error, not a parsing limitation — surface it.
    if (message.includes('password') || message.includes('decrypt')) {
      throw new Error('Incorrect password');
    }
    // Otherwise fall through to the rasterise fallback below.
  }

  // 2) Fallback: render pages via pdf.js (which handles more encrypted files)
  //    and rebuild a flat, unprotected PDF.
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, password }).promise;
    try {
      const newPdfDoc = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });

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
      return await newPdfDoc.save();
    } finally {
      pdf.destroy();
    }
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('password')) {
      throw new Error('Incorrect password');
    }
    throw error;
  }
};

// Protect PDF with a password using real PDF encryption (AES).
// The original page content (text, fonts, vectors) is preserved — the document
// is simply encrypted so it cannot be opened without the password.
export const protectPdf = async (
  file: File,
  password: string,
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // ignoreEncryption lets us load a file that already carries (weak) encryption
  // so it can be re-protected with the new password.
  const doc = await SecurePDFDocument.load(arrayBuffer, { ignoreEncryption: true });

  const totalPages = doc.getPageCount();
  onPageProgress?.(totalPages, totalPages);

  // userPassword  -> required to open/view the document
  // ownerPassword -> required to change permissions; set to the same value so
  //                  there is a single password to remember.
  doc.encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: false,
    },
  });

  return await doc.save();
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
