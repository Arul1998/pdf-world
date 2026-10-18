import { expect, test } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { copyPdf, extractPages, mergePdfs, removePages, splitPdf } from '../src/lib/pdf/pdf-organize';
import { rotatePages } from '../src/lib/pdf/pdf-edit';
async function fixture() {
  const doc = await PDFDocument.create();
  doc.setModificationDate(new Date('2000-01-01T00:00:00Z'));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const width of [200, 300, 400]) {
    doc.addPage([width, 500]).drawText(`Page ${width}`, { x: 20, y: 20, font });
  }
  return new File([new Uint8Array(await doc.save())], 'fixture.pdf', { type: 'application/pdf' });
}
test('merge keeps page order and dimensions', async () => {
  const file = await fixture();
  const output = await PDFDocument.load(await mergePdfs([file, file]));
  expect(output.getPages().map(p => p.getWidth())).toEqual([200, 300, 400, 200, 300, 400]);
});
test('split and extract preserve the selected page order', async () => {
  const file = await fixture();
  const splits = await splitPdf(file, [{ start: 2, end: 3 }]);
  expect((await PDFDocument.load(splits[0])).getPages().map(p => p.getWidth())).toEqual([300, 400]);
  expect((await PDFDocument.load(await extractPages(file, [3, 1]))).getPages().map(p => p.getWidth())).toEqual([400, 200]);
});
test('rotation changes only selected pages', async () => {
  const output = await PDFDocument.load(await rotatePages(await fixture(), 90, [2]));
  expect(output.getPages().map(p => p.getRotation().angle)).toEqual([0, 90, 0]);
});
test('copy produces byte-exact copies, including document-level features', async () => {
  const file = await fixture();
  const original = await new Promise<ArrayBuffer>(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result as ArrayBuffer); r.readAsArrayBuffer(file); });
  const copies = await copyPdf(file, 2);
  expect(copies).toHaveLength(2);
  copies.forEach(copy => expect(copy).toEqual(new Uint8Array(original)));
});
test('rejects extracting no pages', async () => {
  await expect(extractPages(await fixture(), [])).rejects.toThrow(/select at least one page/i);
});
test('rejects removing every page', async () => {
  await expect(removePages(await fixture(), [1, 2, 3])).rejects.toThrow(/at least one page/i);
});
test('rejects reversed split ranges', async () => {
  await expect(splitPdf(await fixture(), [{ start: 3, end: 1 }])).rejects.toThrow(/page range/i);
});
