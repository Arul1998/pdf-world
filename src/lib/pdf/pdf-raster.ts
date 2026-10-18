import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { PDFPageProxy } from 'pdfjs-dist';

export interface RasterizedPage {
  /** JPEG bytes of the rendered page. */
  bytes: Uint8Array;
  /** Page size in PDF points (scale 1, rotation applied). */
  width: number;
  height: number;
}

const canvasToJpegBytes = (canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode page image'));
          return;
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      'image/jpeg',
      quality
    );
  });

// Render a pdf.js page to JPEG bytes. `decorate` runs after rendering and can
// draw on top of the page (e.g. redaction boxes) before it is encoded.
export const renderPageToJpeg = async (
  page: PDFPageProxy,
  scale: number,
  quality: number,
  decorate?: (context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
): Promise<RasterizedPage> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  // Failing loudly beats silently dropping the page from the output.
  if (!context) throw new Error('Could not get a 2D canvas context');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  try {
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    decorate?.(context, canvas);
    const bytes = await canvasToJpegBytes(canvas, quality);
    const original = page.getViewport({ scale: 1 });
    return { bytes, width: original.width, height: original.height };
  } finally {
    // Release the backing store right away; large pages add up quickly.
    canvas.width = 0;
    canvas.height = 0;
  }
};

// Add `raster` to `doc` as a new full-bleed image page and return that page.
export const addRasterPage = async (doc: PDFDocument, raster: RasterizedPage): Promise<PDFPage> => {
  const image = await doc.embedJpg(raster.bytes);
  const newPage = doc.addPage([raster.width, raster.height]);
  newPage.drawImage(image, { x: 0, y: 0, width: raster.width, height: raster.height });
  return newPage;
};
