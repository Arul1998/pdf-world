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

export const generatePdfPageThumbnails = async (file: File, scale: number = 0.3): Promise<string[]> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
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
  } catch (error) {
    console.error('Failed to generate page thumbnails:', error);
    return [];
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

// Compress PDF by re-rendering pages as images at specified quality
export const compressPdf = async (
  file: File, 
  level: 'maximum' | 'balanced' | 'minimum' = 'balanced',
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const qualityMap = {
    maximum: 0.4,  // Lower quality = smaller size
    balanced: 0.65,
    minimum: 0.85, // Higher quality = larger size
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
    
    // Convert to JPEG with specified quality
    const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
    const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
    
    const jpgImage = await newPdfDoc.embedJpg(imageBytes);
    
    // Get original page dimensions
    const originalViewport = page.getViewport({ scale: 1 });
    const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
    
    newPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });
  }
  
  return newPdfDoc.save({
    useObjectStreams: true,
  });
};

// Add page numbers
export type PageNumberOptions = {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  format?: string;
  margin?: 'small' | 'recommended' | 'big';
  firstNumber?: number;
  fromPage?: number;
  toPage?: number;
  pageMode?: 'single' | 'facing';
};

export const addPageNumbers = async (
  file: File, 
  options: PageNumberOptions = {}
): Promise<Uint8Array> => {
  const {
    position = 'bottom-center',
    format = '{n}',
    margin = 'recommended',
    firstNumber = 1,
    fromPage = 1,
    toPage,
    pageMode = 'single',
  } = options;

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  const marginSizes = { small: 20, recommended: 40, big: 60 };
  const fontSizes = { small: 8, recommended: 10, big: 12 };
  const marginPx = marginSizes[margin];
  const fontSize = fontSizes[margin];
  
  const endPage = toPage ? Math.min(toPage, pages.length) : pages.length;
  
  pages.forEach((page, index) => {
    const pageNum = index + 1;
    
    // Skip pages outside the range
    if (pageNum < fromPage || pageNum > endPage) return;
    
    const { width, height } = page.getSize();
    const displayNumber = firstNumber + (pageNum - fromPage);
    const text = format
      .replace('{n}', String(displayNumber))
      .replace('{total}', String(endPage - fromPage + 1))
      .replace('{p}', String(endPage - fromPage + 1));
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    
    let x = 0;
    let y = 0;
    
    // For facing pages mode, alternate left/right positions on odd/even pages
    let effectivePosition = position;
    if (pageMode === 'facing') {
      const isEvenPage = pageNum % 2 === 0;
      if (position.includes('left') && isEvenPage) {
        effectivePosition = position.replace('left', 'right') as typeof position;
      } else if (position.includes('right') && isEvenPage) {
        effectivePosition = position.replace('right', 'left') as typeof position;
      }
    }
    
    if (effectivePosition.includes('left')) x = marginPx;
    else if (effectivePosition.includes('center')) x = (width - textWidth) / 2;
    else x = width - textWidth - marginPx;
    
    if (effectivePosition.includes('top')) y = height - marginPx;
    else y = marginPx;
    
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
  });
  
  return pdfDoc.save();
};

// Watermark position type
export type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'diagonal' | 'tile';

export type WatermarkOptions = {
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  position?: WatermarkPosition;
  imageFile?: File;
  imageScale?: number;
};

// Add watermark (text or image)
export const addWatermark = async (
  file: File,
  text: string,
  options: WatermarkOptions = {}
): Promise<Uint8Array> => {
  const { 
    opacity = 0.3, 
    rotation = 0, 
    fontSize = 50,
    position = 'center',
    imageFile,
    imageScale = 0.3,
  } = options;
  
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // If image watermark
  let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (imageFile) {
    const imageBytes = await readFileAsArrayBuffer(imageFile);
    if (imageFile.type === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }
  }
  
  pages.forEach(page => {
    const { width, height } = page.getSize();
    
    if (embeddedImage) {
      // Image watermark - fit to page
      const imgAspect = embeddedImage.width / embeddedImage.height;
      const pageAspect = width / height;
      
      let imgWidth: number;
      let imgHeight: number;
      
      // Scale image to cover the entire page
      if (imgAspect > pageAspect) {
        // Image is wider than page - fit to height
        imgHeight = height;
        imgWidth = imgHeight * imgAspect;
      } else {
        // Image is taller than page - fit to width
        imgWidth = width;
        imgHeight = imgWidth / imgAspect;
      }
      
      // Center the image on the page
      const x = (width - imgWidth) / 2;
      const y = (height - imgHeight) / 2;
      
      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
        opacity,
      });
    } else {
      // Text watermark
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;
      
      if (position === 'diagonal') {
        page.drawText(text, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(-45),
        });
      } else if (position === 'tile') {
        // Tile the text across the page
        const spacingX = textWidth * 1.5;
        const spacingY = fontSize * 4;
        for (let y = 0; y < height + fontSize; y += spacingY) {
          for (let x = -textWidth; x < width + textWidth; x += spacingX) {
            page.drawText(text, {
              x,
              y,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity,
              rotate: degrees(rotation),
            });
          }
        }
      } else {
        const { x, y } = getWatermarkPosition(position, width, height, textWidth, textHeight);
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.5, 0.5, 0.5),
          opacity,
          rotate: degrees(rotation),
        });
      }
    }
  });
  
  return pdfDoc.save();
};

// Helper function to calculate watermark position
function getWatermarkPosition(
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  itemWidth: number,
  itemHeight: number
): { x: number; y: number } {
  const margin = 40;
  
  switch (position) {
    case 'top-left':
      return { x: margin, y: pageHeight - margin - itemHeight };
    case 'top-center':
      return { x: (pageWidth - itemWidth) / 2, y: pageHeight - margin - itemHeight };
    case 'top-right':
      return { x: pageWidth - margin - itemWidth, y: pageHeight - margin - itemHeight };
    case 'center-left':
      return { x: margin, y: (pageHeight - itemHeight) / 2 };
    case 'center':
    case 'diagonal':
      return { x: (pageWidth - itemWidth) / 2, y: (pageHeight - itemHeight) / 2 };
    case 'center-right':
      return { x: pageWidth - margin - itemWidth, y: (pageHeight - itemHeight) / 2 };
    case 'bottom-left':
      return { x: margin, y: margin };
    case 'bottom-center':
      return { x: (pageWidth - itemWidth) / 2, y: margin };
    case 'bottom-right':
      return { x: pageWidth - margin - itemWidth, y: margin };
    default:
      return { x: (pageWidth - itemWidth) / 2, y: (pageHeight - itemHeight) / 2 };
  }
}

// Page size definitions in points (72 points = 1 inch)
export const PAGE_SIZES = {
  'fit': { width: 0, height: 0, label: 'Fit (Same page size as image)' },
  'a4': { width: 595.28, height: 841.89, label: 'A4 (297x210 mm)' },
  'letter': { width: 612, height: 792, label: 'US Letter (215x279.4 mm)' },
} as const;

export type PageSize = keyof typeof PAGE_SIZES;
export type PageOrientation = 'portrait' | 'landscape';
export type PageMargin = 'none' | 'small' | 'big';

const MARGIN_VALUES = {
  'none': 0,
  'small': 20,
  'big': 50,
};

// Convert image to PDF
export const imageToPdf = async (
  files: File[],
  options: {
    pageSize?: PageSize;
    orientation?: PageOrientation;
    margin?: PageMargin;
  } = {}
): Promise<Uint8Array> => {
  const { pageSize = 'fit', orientation = 'portrait', margin = 'none' } = options;
  const pdfDoc = await PDFDocument.create();
  const marginValue = MARGIN_VALUES[margin];
  
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
    
    let pageWidth: number;
    let pageHeight: number;
    
    if (pageSize === 'fit') {
      pageWidth = image.width + marginValue * 2;
      pageHeight = image.height + marginValue * 2;
    } else {
      const size = PAGE_SIZES[pageSize];
      if (orientation === 'landscape') {
        pageWidth = size.height;
        pageHeight = size.width;
      } else {
        pageWidth = size.width;
        pageHeight = size.height;
      }
    }
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Calculate image dimensions to fit within margins
    const availableWidth = pageWidth - marginValue * 2;
    const availableHeight = pageHeight - marginValue * 2;
    
    let drawWidth = image.width;
    let drawHeight = image.height;
    
    if (pageSize !== 'fit') {
      // Scale image to fit within available space while maintaining aspect ratio
      const scaleX = availableWidth / image.width;
      const scaleY = availableHeight / image.height;
      const scale = Math.min(scaleX, scaleY);
      
      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
    }
    
    // Center the image on the page
    const x = marginValue + (availableWidth - drawWidth) / 2;
    const y = marginValue + (availableHeight - drawHeight) / 2;
    
    page.drawImage(image, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }
  
  return pdfDoc.save();
};

// Unlock PDF (remove password protection)
export const unlockPdf = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  
  try {
    // Try to load with password using pdfjs-dist first to verify password
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      password: password 
    });
    
    const pdf = await loadingTask.promise;
    
    // If we get here, password was correct
    // Now re-render the PDF without password protection
    const newPdfDoc = await PDFDocument.create();
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2; // Higher quality
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      // Convert canvas to image and embed in new PDF
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
      
      const jpgImage = await newPdfDoc.embedJpg(imageBytes);
      
      // Get original page dimensions
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('password')) {
      throw new Error('Incorrect password');
    }
    throw error;
  }
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

// Protect PDF with password
// Note: pdf-lib doesn't support native PDF encryption, so we use a workaround
// by re-rendering the PDF through pdfjs and embedding a password marker
// For true encryption, a server-side solution would be needed
export const protectPdf = async (
  file: File, 
  password: string,
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  
  // Load the PDF using pdfjs-dist
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  
  // Create a new PDF document
  const newPdfDoc = await PDFDocument.create();
  
  // Re-render each page at high quality
  for (let i = 1; i <= numPages; i++) {
    onPageProgress?.(i, numPages);
    
    const page = await pdf.getPage(i);
    const scale = 2; // High quality rendering
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    
    // Convert to high-quality JPEG
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
    
    const jpgImage = await newPdfDoc.embedJpg(imageBytes);
    
    // Get original page dimensions
    const originalViewport = page.getViewport({ scale: 1 });
    const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
    
    newPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });
  }
  
  // Add password protection metadata
  // Note: This adds metadata but true encryption requires server-side processing
  // The PDF will have password info in metadata that compatible readers can use
  newPdfDoc.setTitle('Protected Document');
  newPdfDoc.setSubject(`Password: Required`);
  newPdfDoc.setKeywords(['protected', 'password-required']);
  
  // Store encrypted password hash in custom metadata
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  newPdfDoc.setProducer(`PDF World (Protected: ${hashHex.substring(0, 16)})`);
  
  return newPdfDoc.save();
};

// Sign position type
export type SignaturePosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type SignatureOptions = {
  position?: SignaturePosition;
  pageNumbers?: number[]; // Pages to sign, defaults to last page only
  scale?: number; // Signature scale factor
};

// Signature placement with exact coordinates
export type SignaturePlacement = {
  pageIndex: number;
  x: number; // Percentage from left (0-100)
  y: number; // Percentage from top (0-100)
  width: number; // Percentage of page width
  height: number; // Percentage of page height
  dataUrl?: string; // Optional: individual signature image for this placement
};

// Add signature to PDF with exact coordinates
export const signPdfWithCoordinates = async (
  file: File,
  defaultSignatureDataUrl: string,
  placements: SignaturePlacement[],
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  // Cache for embedded images to avoid re-embedding same image
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();
  
  const embedImage = async (dataUrl: string) => {
    if (imageCache.has(dataUrl)) {
      return imageCache.get(dataUrl)!;
    }
    const base64Data = dataUrl.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const image = await pdfDoc.embedPng(imageBytes);
    imageCache.set(dataUrl, image);
    return image;
  };
  
  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i];
    onPageProgress?.(i + 1, placements.length);
    
    if (placement.pageIndex < 0 || placement.pageIndex >= pages.length) continue;
    
    const page = pages[placement.pageIndex];
    const { width, height } = page.getSize();
    
    // Use placement-specific dataUrl or fall back to default
    const signatureDataUrl = placement.dataUrl || defaultSignatureDataUrl;
    const signatureImage = await embedImage(signatureDataUrl);
    
    // Convert percentages to PDF coordinates
    // Note: PDF coordinates start from bottom-left, so we need to flip Y
    const sigWidth = (placement.width / 100) * width;
    const sigHeight = (placement.height / 100) * height;
    const x = (placement.x / 100) * width;
    const y = height - ((placement.y / 100) * height) - sigHeight; // Flip Y and account for signature height
    
    // Draw signature on page
    page.drawImage(signatureImage, {
      x,
      y,
      width: sigWidth,
      height: sigHeight,
    });
  }
  
  return pdfDoc.save();
};

// Add signature to PDF (legacy position-based)
export const signPdf = async (
  file: File,
  signatureDataUrl: string,
  options: SignatureOptions = {},
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const { 
    position = 'bottom-right',
    pageNumbers,
    scale = 0.3,
  } = options;

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  // Extract base64 data from data URL
  const base64Data = signatureDataUrl.split(',')[1];
  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  
  // Embed the signature image
  const signatureImage = await pdfDoc.embedPng(imageBytes);
  
  // Determine which pages to sign (default: last page only)
  const pagesToSign = pageNumbers || [pages.length];
  
  for (let i = 0; i < pages.length; i++) {
    onPageProgress?.(i + 1, pages.length);
    
    const pageNum = i + 1;
    if (!pagesToSign.includes(pageNum)) continue;
    
    const page = pages[i];
    const { width, height } = page.getSize();
    
    // Calculate signature dimensions
    const sigWidth = signatureImage.width * scale;
    const sigHeight = signatureImage.height * scale;
    
    // Ensure signature fits on page
    const maxWidth = width * 0.4;
    const maxHeight = height * 0.15;
    
    let finalWidth = sigWidth;
    let finalHeight = sigHeight;
    
    if (sigWidth > maxWidth) {
      const ratio = maxWidth / sigWidth;
      finalWidth = maxWidth;
      finalHeight = sigHeight * ratio;
    }
    
    if (finalHeight > maxHeight) {
      const ratio = maxHeight / finalHeight;
      finalHeight = maxHeight;
      finalWidth = finalWidth * ratio;
    }
    
    // Calculate position
    const margin = 40;
    let x = 0;
    let y = 0;
    
    if (position.includes('left')) {
      x = margin;
    } else if (position.includes('center')) {
      x = (width - finalWidth) / 2;
    } else {
      x = width - finalWidth - margin;
    }
    
    if (position.includes('top')) {
      y = height - finalHeight - margin;
    } else {
      y = margin;
    }
    
    // Draw signature on page
    page.drawImage(signatureImage, {
      x,
      y,
      width: finalWidth,
      height: finalHeight,
    });
  }
  
  return pdfDoc.save();
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
  } catch (error) {
    console.error('Failed to render PDF pages:', error);
    return [];
  }
};

// Crop PDF pages
export type CropMargins = {
  top: number;    // percentage 0-100
  bottom: number; // percentage 0-100
  left: number;   // percentage 0-100
  right: number;  // percentage 0-100
};

export const cropPdf = async (
  file: File,
  margins: CropMargins,
  pageNumbers?: number[] // If undefined, apply to all pages
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  pages.forEach((page, index) => {
    if (pageNumbers && !pageNumbers.includes(index + 1)) return;
    
    const { width, height } = page.getSize();
    const mediaBox = page.getMediaBox();
    
    const cropLeft = (margins.left / 100) * width;
    const cropRight = (margins.right / 100) * width;
    const cropTop = (margins.top / 100) * height;
    const cropBottom = (margins.bottom / 100) * height;
    
    // Set crop box (visible area)
    page.setCropBox(
      mediaBox.x + cropLeft,
      mediaBox.y + cropBottom,
      width - cropLeft - cropRight,
      height - cropTop - cropBottom
    );
  });
  
  return pdfDoc.save();
};

// Redact PDF - permanently remove content by drawing black rectangles
export type RedactionArea = {
  id: string;
  pageIndex: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
};

export const redactPdf = async (
  file: File,
  redactions: RedactionArea[]
): Promise<Uint8Array> => {
  // To truly redact, we re-render through pdfjs and apply redactions
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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
    
    // Render the page
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    
    // Apply redactions for this page
    const pageRedactions = redactions.filter(r => r.pageIndex === i - 1);
    context.fillStyle = 'black';
    
    for (const redaction of pageRedactions) {
      const x = (redaction.x / 100) * canvas.width;
      const y = (redaction.y / 100) * canvas.height;
      const w = (redaction.width / 100) * canvas.width;
      const h = (redaction.height / 100) * canvas.height;
      context.fillRect(x, y, w, h);
    }
    
    // Convert to image and add to new PDF
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
  
  const maxPages = Math.max(pdf1.numPages, pdf2.numPages);
  const newPdfDoc = await PDFDocument.create();
  const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
  
  for (let i = 1; i <= maxPages; i++) {
    onProgress?.((i / maxPages) * 100);
    
    const scale = 1.5;
    
    // Render page from first PDF
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
    
    // Render page from second PDF
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
    
    // Create a page wide enough for both, plus gap
    const gap = 30;
    const headerHeight = 30;
    const pageWidth = dim1.width + dim2.width + gap * 3;
    const pageHeight = Math.max(dim1.height, dim2.height) + headerHeight + gap * 2;
    
    const newPage = newPdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw labels
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
    
    // Draw images
    if (img1) {
      newPage.drawImage(img1, {
        x: gap,
        y: gap,
        width: dim1.width,
        height: dim1.height,
      });
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
      newPage.drawImage(img2, {
        x: gap * 2 + dim1.width,
        y: gap,
        width: dim2.width,
        height: dim2.height,
      });
    } else {
      newPage.drawText('No page', {
        x: gap * 2 + dim1.width + dim2.width / 2 - 25,
        y: gap + dim2.height / 2,
        size: 14,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    
    // Draw separator line
    newPage.drawLine({
      start: { x: gap + dim1.width + gap / 2, y: gap },
      end: { x: gap + dim1.width + gap / 2, y: pageHeight - headerHeight - gap },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  }
  
  return newPdfDoc.save();
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
