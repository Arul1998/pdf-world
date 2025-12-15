import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker for v5.x
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PDFFile {
  id: string;
  name: string;
  file: File;
  pageCount?: number;
  size: number;
  thumbnail?: string;
}

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const getPdfPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  return pdfDoc.getPageCount();
};

export const generatePdfThumbnail = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    
    const scale = 0.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return '';
  }
};

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

// Rotate pages
export const rotatePages = async (file: File, rotation: 90 | 180 | 270, pageNumbers?: number[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  pages.forEach((page, index) => {
    if (!pageNumbers || pageNumbers.includes(index + 1)) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotation));
    }
  });
  
  return pdfDoc.save();
};

// Compress PDF (basic compression by removing metadata and optimizing)
export const compressPdf = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  
  return pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });
};

// Add page numbers
export const addPageNumbers = async (
  file: File, 
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' = 'bottom-center',
  format: string = 'Page {n} of {total}'
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  
  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const text = format.replace('{n}', String(index + 1)).replace('{total}', String(pages.length));
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    let x = 0;
    let y = 0;
    
    if (position.includes('left')) x = 40;
    else if (position.includes('center')) x = (width - textWidth) / 2;
    else x = width - textWidth - 40;
    
    if (position.includes('top')) y = height - 30;
    else y = 30;
    
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
  });
  
  return pdfDoc.save();
};

// Add watermark
export const addWatermark = async (
  file: File,
  text: string,
  options: { opacity?: number; rotation?: number; fontSize?: number } = {}
): Promise<Uint8Array> => {
  const { opacity = 0.3, rotation = -45, fontSize = 50 } = options;
  
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  pages.forEach(page => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(rotation),
    });
  });
  
  return pdfDoc.save();
};

// Convert image to PDF
export const imageToPdf = async (files: File[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  
  for (const file of files) {
    const imageBytes = await readFileAsArrayBuffer(file);
    
    let image;
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      image = await pdfDoc.embedJpg(imageBytes);
    } else if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      continue;
    }
    
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }
  
  return pdfDoc.save();
};

// PDF to images
export const pdfToImages = async (file: File, format: 'jpeg' | 'png' = 'jpeg', quality: number = 0.9): Promise<string[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    images.push(canvas.toDataURL(`image/${format}`, quality));
  }
  
  return images;
};

// Download helper
export const downloadBlob = (data: Uint8Array | string, filename: string, mimeType: string = 'application/pdf') => {
  let blob: Blob;
  
  if (typeof data === 'string') {
    // For base64 data URLs
    const byteString = atob(data.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    blob = new Blob([ab], { type: mimeType });
  } else {
    // Convert Uint8Array to regular ArrayBuffer for Blob
    blob = new Blob([new Uint8Array(data)], { type: mimeType });
  }
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Download multiple files as zip would require a zip library, so we'll download individually
export const downloadMultiple = async (files: { data: Uint8Array | string; name: string; mimeType?: string }[]) => {
  for (const file of files) {
    downloadBlob(file.data, file.name, file.mimeType);
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
  }
};
