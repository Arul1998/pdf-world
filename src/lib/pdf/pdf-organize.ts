import { PDFDocument } from 'pdf-lib';
import { readFileAsArrayBuffer } from './pdf-core';

// Merge PDFs
export const mergePdfs = async (files: File[], onProgress?: (progress: number) => void): Promise<Uint8Array> => {
  if (files.length === 0) throw new Error('Select at least one PDF to merge.');
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
  if (!ranges.length || ranges.some(range => !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 1 || range.end < range.start || range.end > sourcePdf.getPageCount())) {
    throw new Error('Invalid page range. Choose existing pages in ascending order.');
  }
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

  if (!pageNumbers.length) throw new Error('Select at least one page.');
  if (pageNumbers.some(page => !Number.isInteger(page) || page < 1 || page > sourcePdf.getPageCount())) throw new Error('Invalid page number.');
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

// Copy the original bytes instead of re-saving: preserve metadata and signatures.
export const copyPdf = async (file: File, count: number = 1): Promise<Uint8Array[]> => {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Choose between 1 and 20 copies.');
  const original = new Uint8Array(await readFileAsArrayBuffer(file));
  return Array.from({ length: count }, () => original.slice());
};
