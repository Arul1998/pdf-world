import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { readFileAsArrayBuffer } from './pdf-core';

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

    const availableWidth = pageWidth - marginValue * 2;
    const availableHeight = pageHeight - marginValue * 2;

    let drawWidth = image.width;
    let drawHeight = image.height;

    if (pageSize !== 'fit') {
      const scaleX = availableWidth / image.width;
      const scaleY = availableHeight / image.height;
      const scale = Math.min(scaleX, scaleY);

      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
    }

    const x = marginValue + (availableWidth - drawWidth) / 2;
    const y = marginValue + (availableHeight - drawHeight) / 2;

    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }

  return pdfDoc.save();
};

// PDF to images
export const pdfToImages = async (file: File, format: 'jpeg' | 'png' = 'jpeg', quality: number = 0.9): Promise<string[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  try {
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
  } finally {
    pdf.destroy();
  }

  return images;
};
