import { afterEach, expect, test, vi } from 'vitest';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Exercise real PDF.js rendering. Only substitute the browser worker setup and
// browser canvas surface with their Node equivalents; no PDF behavior is mocked.
vi.mock('../src/lib/pdf/pdfjs-setup', async () => {
  const canvas = await import('@napi-rs/canvas');
  Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix, Path2D: canvas.Path2D, ImageData: canvas.ImageData });
  return { pdfjsLib: await import('pdfjs-dist/legacy/build/pdf.mjs') };
});
import { redactPdf, type RedactionArea } from '../src/lib/pdf/pdf-security';
const dirs: string[] = [];
afterEach(() => { dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })); });
async function fixture(width = 300, height = 400) {
  const doc = await PDFDocument.create();
  doc.setTitle('SECRET metadata');
  const page = doc.addPage([width, height]);
  page.drawRectangle({ width, height, color: rgb(1, 1, 0) });
  page.drawText('SECRET text', { x: 60, y: 100, font: await doc.embedFont(StandardFonts.Helvetica), size: 12 });
  page.setCropBox(50, 50, width - 100, height - 100);
  page.setRotation(degrees(90));
  const field = doc.getForm().createTextField('secretField'); field.setText('SECRET form');
  field.addToPage(page, { x: 80, y: 150, width: 80, height: 25 });
  await doc.attach(new Uint8Array([83, 69, 67, 82, 69, 84]), 'secret.txt');
  return new File([new Uint8Array(await doc.save())], 'sensitive.pdf');
}
function nativeCanvases() {
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? createCanvas(1, 1) as unknown as HTMLCanvasElement : create(tag, options));
}
const area: RedactionArea = { id: 'one', pageIndex: 0, x: 0, y: 0, width: 20, height: 20 };
test('redaction refuses invalid or missing areas instead of exporting uncovered content', async () => {
  nativeCanvases(); const file = await fixture();
  for (const areas of [[], [{ ...area, pageIndex: 2 }], [{ ...area, x: NaN }], [{ ...area, x: 95 }], [{ ...area, width: 0 }]]) {
    await expect(redactPdf(file, areas)).rejects.toThrow(/redaction|area|page/i);
  }
});
test('redaction fails rather than silently dropping pages without a canvas', async () => {
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => tag === 'canvas'
    ? { getContext: () => null } as unknown as HTMLCanvasElement : create(tag, options));
  await expect(redactPdf(await fixture(), [area])).rejects.toThrow(/canvas/i);
});
test('redaction refuses oversized rendering before allocating a canvas', async () => {
  nativeCanvases();
  await expect(redactPdf(await fixture(3000, 3000), [area])).rejects.toThrow(/large|pixel|limit/i);
});
test('rotated cropped output has a black mask and no original text, forms, metadata or attachments', async () => {
  nativeCanvases();
  const bytes = await redactPdf(await fixture(), [area]);
  const dir = mkdtempSync(join(tmpdir(), 'pdf-redaction-')); dirs.push(dir);
  const path = join(dir, 'output.pdf'); writeFileSync(path, bytes);
  expect(execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' }).trim()).toBe('');
  expect(execFileSync('pdfdetach', ['-list', path], { encoding: 'utf8' })).toMatch(/0 embedded files/);
  const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
  expect(info).not.toContain('SECRET'); expect(info).toMatch(/Form:\s+none/);
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getPages().map(p => p.getSize())).toEqual([{ width: 300, height: 200 }]);
  expect(parsed.getPages()[0].getRotation().angle).toBe(0);
  execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to-x', '300', '-scale-to-y', '200', '-png', path, join(dir, 'page')]);
  const image = await loadImage(join(dir, 'page.png'));
  const canvas = createCanvas(300, 200); const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
  expect(Array.from(context.getImageData(10, 10, 1, 1).data)).toEqual([0, 0, 0, 255]);
  expect(Array.from(context.getImageData(100, 10, 1, 1).data)).toEqual([255, 255, 0, 255]);
});

test('redaction preview rejects oversized pages before drawing them', async () => {
  nativeCanvases();
  const { renderPdfPages } = await import('../src/lib/pdf/pdf-render');
  await expect(renderPdfPages(await fixture(3000, 3000), 1.5, {
    maxPages: 100, maxPagePixels: 16_000_000, maxTotalPixels: 64_000_000,
  })).rejects.toThrow(/large|limit/i);
});
