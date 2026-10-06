import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// @cantoo/pdf-lib is a drop-in pdf-lib fork that adds real (AES) PDF encryption
// and decryption. We use it only for the password tools so the rest of the app
// keeps using the mainline pdf-lib build.
import { PDFDocument as SecurePDFDocument, PDFHeader, PDFInvalidObject, PDFRef, PDFRawStream, PDFName, PDFObject, PDFString, PDFHexString, PDFDict, PDFArray, PDFStream, PDFCatalog, PDFPageTree, PDFPageLeaf } from '@cantoo/pdf-lib';
import { pdfjsLib } from './pdfjs-setup';
import { readFileAsArrayBuffer } from './pdf-core';
import { REDACTION_RENDER_LIMITS } from './pdf-render';

// Canonical hex strings avoid PDF delimiter/escape ambiguity. This traversal
// only visits directly owned values; indirect refs have their own cipher key.
const hexBytes = (bytes: Uint8Array): PDFHexString => PDFHexString.of(
  Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
);
const rewriteOwnedStrings = (
  object: PDFObject,
  transform: (value: PDFString | PDFHexString) => PDFHexString
): PDFObject => {
  if (object instanceof PDFString || object instanceof PDFHexString) return transform(object);
  if (object instanceof PDFStream) rewriteOwnedStrings(object.dict, transform);
  else if (object instanceof PDFDict) {
    const signature = object.get(PDFName.of('Type')) === PDFName.of('Sig');
    for (const [key, value] of object.entries()) {
      // Signature Contents are exempt from encryption under the PDF standard.
      if (signature && key === PDFName.of('Contents')) continue;
      object.set(key, rewriteOwnedStrings(value, transform));
    }
  } else if (object instanceof PDFArray) {
    for (let i = 0; i < object.size(); i++) object.set(i, rewriteOwnedStrings(object.get(i), transform));
  }
  return object;
};

// Remove encryption from the decrypted document itself so catalog-level
// forms, attachments and outlines survive. Unsupported inputs fail explicitly;
// unlocking must never silently turn a searchable document into screenshots.
export const unlockPdf = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  try {
    const source = await SecurePDFDocument.load(arrayBuffer, { ignoreEncryption: true, updateMetadata: false });
    const encryptionRef = source.context.trailerInfo.Encrypt;
    const doc = await SecurePDFDocument.load(arrayBuffer, { password, updateMetadata: false, preserveXFA: true });
    // The decryption parser also visits the obsolete encryption dictionary.
    // Remove that dictionary before checking for malformed content objects.
    if (encryptionRef instanceof PDFRef) doc.context.delete(encryptionRef);
    // Cross-reference streams are never encrypted. The fork tries to decrypt
    // them anyway; discard only these obsolete indexes, which save rebuilds.
    for (const [ref, object] of source.context.enumerateIndirectObjects()) {
      if (object instanceof PDFRawStream && object.dict.get(PDFName.of('Type')) === PDFName.of('XRef')) {
        doc.context.delete(ref);
      }
    }
    if (doc.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFInvalidObject)) {
      throw new Error('Damaged PDF objects');
    }
    // In uncompressed encrypted objects, the fork stores decrypted literal
    // bytes as an unescaped PDFString. Preserve raw bytes, not asBytes()'s
    // second escape interpretation. Strings inside object streams were not
    // individually decrypted and must retain normal PDF escape semantics.
    if (encryptionRef) {
      for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
        if (!source.context.lookup(ref)) continue;
        doc.context.assign(ref, rewriteOwnedStrings(object, value => value instanceof PDFHexString ? value :
          hexBytes(Uint8Array.from(value.asString(), char => char.charCodeAt(0)))));
      }
    }
    delete doc.context.trailerInfo.Encrypt;
    doc.context.security = undefined;
    return await doc.save({ updateFieldAppearances: false, useObjectStreams: false });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('password')) throw new Error('Incorrect or missing password');
    throw new Error('Unable to unlock this PDF without losing content. The file may be damaged or use unsupported encryption.');
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
  // The library's AES-128 password algorithm supports at most 32 bytes.
  // Reject unsupported values rather than silently truncate a password.
  if (!password.trim() || password.length < 4 || password.length > 32 || /[^\x20-\x7e]/.test(password)) {
    throw new Error('Password must contain 4 to 32 printable ASCII characters.');
  }
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const doc = await SecurePDFDocument.load(arrayBuffer, { ignoreEncryption: true, updateMetadata: false, preserveXFA: true });
  if (doc.isEncrypted) throw new Error('This PDF is already encrypted. Unlock it before setting a new password.');
  if (doc.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFInvalidObject)) {
    throw new Error('The PDF contains damaged objects and cannot be safely encrypted.');
  }
  // Encryption selection depends on the input header. Always use PDF 1.7
  // so older inputs receive AES-128 rather than legacy 40-bit RC4.
  doc.context.header = PDFHeader.forVersion(1, 7);

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

  // @cantoo/pdf-lib 2.8.1 encrypts stream bodies, but leaves string values in
  // uncompressed objects plaintext. Encrypt those values with the same library
  // cipher and the owning object's number/generation before the writer runs.
  // Keep this package pinned: these categories match its PDFStreamWriter.
  const security = doc.context.security;
  if (!security) throw new Error('Unable to initialize PDF encryption.');
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (ref === doc.context.trailerInfo.Encrypt) continue;
    if (object instanceof PDFRawStream && [PDFName.of('XRef'), PDFName.of('ObjStm')].includes(object.dict.get(PDFName.of('Type')) as PDFName)) continue;
    const uncompressed = object instanceof PDFStream || object instanceof PDFCatalog ||
      object instanceof PDFPageTree || object instanceof PDFPageLeaf || ref.generationNumber !== 0 ||
      (object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Sig'));
    if (uncompressed) {
      const encrypt = security.getEncryptFn(ref.objectNumber, ref.generationNumber);
      doc.context.assign(ref, rewriteOwnedStrings(object, value => hexBytes(encrypt(value.asBytes()))));
    }
  }
  return await doc.save({ updateFieldAppearances: false, useObjectStreams: true });
};

// Flatten every page into a fresh image-only PDF. Original text, document
// metadata, form fields and attachments are intentionally not copied.
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
  if (redactions.length === 0) throw new Error('Select at least one redaction area.');
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const task = pdfjsLib.getDocument({ data: arrayBuffer });
  try {
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > REDACTION_RENDER_LIMITS.maxPages) throw new Error('Redaction is limited to 100 pages per PDF.');
    for (const area of redactions) {
      if (!Number.isInteger(area.pageIndex) || area.pageIndex < 0 || area.pageIndex >= pdf.numPages ||
          ![area.x, area.y, area.width, area.height].every(Number.isFinite) ||
          area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0 ||
          area.x + area.width > 100 + 1e-8 || area.y + area.height > 100 + 1e-8) {
        throw new Error('Invalid redaction area or page. Please mark the areas again.');
      }
    }
    const newPdfDoc = await PDFDocument.create();
    let totalPixels = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const canvas = document.createElement('canvas');
      try {
        const viewport = page.getViewport({ scale: 2 });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        const pixels = width * height;
        totalPixels += pixels;
        if (![width, height].every(v => Number.isFinite(v) && v > 0) || pixels > REDACTION_RENDER_LIMITS.maxPagePixels || totalPixels > REDACTION_RENDER_LIMITS.maxTotalPixels) {
          throw new Error('This PDF is too large to redact safely in this browser. Use a smaller document.');
        }
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Unable to create a canvas. No redacted PDF was exported.');
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        context.fillStyle = '#000000';
        for (const area of redactions.filter(r => r.pageIndex === i - 1)) {
          // Percentages are relative to the rotated, cropped preview viewport.
          // Round outwards so a fractional boundary cannot leave exposed pixels.
          const x = Math.floor(area.x / 100 * width);
          const y = Math.floor(area.y / 100 * height);
          const right = Math.ceil((area.x + area.width) / 100 * width);
          const bottom = Math.ceil((area.y + area.height) / 100 * height);
          context.fillRect(x, y, right - x, bottom - y);
        }
        const encoded = canvas.toDataURL('image/png');
        const imageBytes = Uint8Array.from(atob(encoded.split(',')[1]), c => c.charCodeAt(0));
        const image = await newPdfDoc.embedPng(imageBytes);
        const original = page.getViewport({ scale: 1 });
        newPdfDoc.addPage([original.width, original.height]).drawImage(image, {
          x: 0, y: 0, width: original.width, height: original.height,
        });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    }
    return await newPdfDoc.save();
  } finally {
    await task.destroy();
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
