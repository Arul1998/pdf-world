import { expect, test, vi } from 'vitest';
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
import '../src/pages/tools/EditPdf';
import { Rect, FabricImage } from 'fabric';
test('editor shapes retain their top-left position after the Fabric upgrade', () => {
  const shape = new Rect({ left: 10, top: 20, width: 100, height: 50, strokeWidth: 0 });
  expect(shape.getBoundingRect()).toEqual({ left: 10, top: 20, width: 100, height: 50 });
});
test('editor PDF backgrounds begin at the canvas origin', () => {
  const image = new FabricImage(document.createElement('canvas'), { left: 0, top: 0, width: 300, height: 400 });
  expect(image.getBoundingRect()).toEqual({ left: 0, top: 0, width: 300, height: 400 });
});
