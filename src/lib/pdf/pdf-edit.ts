import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import { readFileAsArrayBuffer } from './pdf-core';

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

// Watermark types
export type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'diagonal' | 'tile';

export type WatermarkOptions = {
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  position?: WatermarkPosition;
  imageFile?: File;
  imageScale?: number;
};

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
  } = options;

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
      const imgAspect = embeddedImage.width / embeddedImage.height;
      const pageAspect = width / height;

      let imgWidth: number;
      let imgHeight: number;

      if (imgAspect > pageAspect) {
        imgHeight = height;
        imgWidth = imgHeight * imgAspect;
      } else {
        imgWidth = width;
        imgHeight = imgWidth / imgAspect;
      }

      const x = (width - imgWidth) / 2;
      const y = (height - imgHeight) / 2;

      page.drawImage(embeddedImage, { x, y, width: imgWidth, height: imgHeight, opacity });
    } else {
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

// Crop PDF
export type CropMargins = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export const cropPdf = async (
  file: File,
  margins: CropMargins,
  pageNumbers?: number[]
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

    page.setCropBox(
      mediaBox.x + cropLeft,
      mediaBox.y + cropBottom,
      width - cropLeft - cropRight,
      height - cropTop - cropBottom
    );
  });

  return pdfDoc.save();
};

// Signature types
export type SignaturePosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type SignatureOptions = {
  position?: SignaturePosition;
  pageNumbers?: number[];
  scale?: number;
};

export type SignaturePlacement = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl?: string;
};

// Add signature with exact coordinates
export const signPdfWithCoordinates = async (
  file: File,
  defaultSignatureDataUrl: string,
  placements: SignaturePlacement[],
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

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

    const signatureDataUrl = placement.dataUrl || defaultSignatureDataUrl;
    const signatureImage = await embedImage(signatureDataUrl);

    const sigWidth = (placement.width / 100) * width;
    const sigHeight = (placement.height / 100) * height;
    const x = (placement.x / 100) * width;
    const y = height - ((placement.y / 100) * height) - sigHeight;

    page.drawImage(signatureImage, { x, y, width: sigWidth, height: sigHeight });
  }

  return pdfDoc.save();
};

// Add signature (legacy position-based)
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

  const base64Data = signatureDataUrl.split(',')[1];
  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(imageBytes);

  const pagesToSign = pageNumbers || [pages.length];

  for (let i = 0; i < pages.length; i++) {
    onPageProgress?.(i + 1, pages.length);

    const pageNum = i + 1;
    if (!pagesToSign.includes(pageNum)) continue;

    const page = pages[i];
    const { width, height } = page.getSize();

    const sigWidth = signatureImage.width * scale;
    const sigHeight = signatureImage.height * scale;

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

    const margin = 40;
    let x = 0;
    let y = 0;

    if (position.includes('left')) x = margin;
    else if (position.includes('center')) x = (width - finalWidth) / 2;
    else x = width - finalWidth - margin;

    if (position.includes('top')) y = height - finalHeight - margin;
    else y = margin;

    page.drawImage(signatureImage, { x, y, width: finalWidth, height: finalHeight });
  }

  return pdfDoc.save();
};
