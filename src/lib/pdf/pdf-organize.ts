import { PDFDocument } from 'pdf-lib';
import { readFileAsArrayBuffer } from './pdf-core';

// Merge PDFs
export const mergePdfs = async (files: File[], onProgress?: (progress: number) => void): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const arrayBuffer = await readFileAsArrayBuffer(files[i]);
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
    onProgress?.((i + 1) / files.length * 100);
  }

  return mergedPdf.save();
};

// Split PDF
export const splitPdf = async (file: File, ranges: { start: number; end: number }[]): Promise<Uint8Array[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const results: Uint8Array[] = [];

  for (const range of ranges) {
    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let i = range.start - 1; i < range.end; i++) {
      pageIndices.push(i);
    }
    const pages = await newPdf.copyPages(sourcePdf, pageIndices);
    pages.forEach(page => newPdf.addPage(page));
    results.push(await newPdf.save());
  }

  return results;
};

// Extract pages
export const extractPages = async (file: File, pageNumbers: number[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const pageIndices = pageNumbers.map(n => n - 1);
  const pages = await newPdf.copyPages(sourcePdf, pageIndices);
  pages.forEach(page => newPdf.addPage(page));

  return newPdf.save();
};

// Remove pages
export const removePages = async (file: File, pageNumbers: number[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  const totalPages = sourcePdf.getPageCount();
  const pagesToKeep = [];

  for (let i = 1; i <= totalPages; i++) {
    if (!pageNumbers.includes(i)) {
      pagesToKeep.push(i);
    }
  }

  return extractPages(file, pagesToKeep);
};

// Copy PDF - create exact copies
export const copyPdf = async (file: File, count: number = 1): Promise<Uint8Array[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const results: Uint8Array[] = [];

  for (let i = 0; i < count; i++) {
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    results.push(await pdfDoc.save());
  }

  return results;
};
