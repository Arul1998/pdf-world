import { afterEach, expect, test, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Production encrypts using cantoo; Poppler independently reads the output.
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
import { protectPdf, unlockPdf } from '../src/lib/pdf/pdf-security';
const dirs: string[] = [];
afterEach(() => { dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })); });
async function fixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText('Visible content', { x: 20, y: 300, font, size: 12 });
  const field = doc.getForm().createTextField('customer');
  field.setText('Arul');
  field.addToPage(page, { x: 20, y: 200, width: 100, height: 25 });
  await doc.attach(new Uint8Array([65, 66, 67]), 'note.txt');
  return new File([new Uint8Array(await doc.save())], 'form.pdf');
}
function outputPath(bytes: Uint8Array) {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-security-')); dirs.push(dir);
  const path = join(dir, 'output.pdf'); writeFileSync(path, bytes); return path;
}
function asFile(bytes: Uint8Array) { return new File([new Uint8Array(bytes)], 'locked.pdf'); }
test('protection rejects empty and whitespace-only passwords', async () => {
  const file = await fixture();
  for (const password of ['', '   ']) await expect(protectPdf(file, password)).rejects.toThrow(/password/i);
});
test.each(['Correct-123!', 'Password with spaces!'])('encrypted output opens only with the supplied password: %s', async password => {
  const bytes = await protectPdf(await fixture(), password);
  const path = outputPath(bytes);
  expect(execFileSync('pdftotext', ['-upw', password, path, '-'], { encoding: 'utf8' })).toContain('Visible content');
  expect(() => execFileSync('pdftotext', ['-upw', 'wrong', path, '-'], { stdio: 'pipe' })).toThrow();
  expect(() => execFileSync('pdftotext', [path, '-'], { stdio: 'pipe' })).toThrow();
});
test('protect rejects encrypted inputs instead of re-saving undecrypted streams', async () => {
  const encrypted = await protectPdf(await fixture(), 'Original-123!');
  await expect(protectPdf(asFile(encrypted), 'New-456!')).rejects.toThrow(/unlock|encrypted/i);
});
test('unlock preserves forms, attachments and searchable page text', async () => {
  const locked = await protectPdf(await fixture(), 'Correct-123!');
  const unlocked = await unlockPdf(asFile(locked), 'Correct-123!');
  const path = outputPath(unlocked);
  expect(execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' })).toContain('Visible content');
  expect(execFileSync('pdfinfo', [path], { encoding: 'utf8' })).toMatch(/Encrypted:\s+no/);
  const parsed = await PDFDocument.load(unlocked);
  expect(parsed.getForm().getTextField('customer').getText()).toBe('Arul');
  expect(execFileSync('pdfdetach', ['-list', path], { encoding: 'utf8' })).toContain('note.txt');
});
test('unlock rejects incorrect and missing passwords', async () => {
  const file = asFile(await protectPdf(await fixture(), 'Correct-123!'));
  for (const password of ['wrong', '']) await expect(unlockPdf(file, password)).rejects.toThrow(/password/i);
});

test('protection gives a clear error for unsupported passwords before creating an unreadable file', async () => {
  for (const password of ['abc', 'தமிழ்-秘密-123', 'a'.repeat(33)]) {
    await expect(protectPdf(await fixture(), password)).rejects.toThrow(/4.*32|ASCII/i);
  }
});
test('older PDF inputs still receive AES encryption', async () => {
  const { PDFHeader } = await import('pdf-lib');
  const doc = await PDFDocument.create(); doc.addPage();
  doc.context.header = PDFHeader.forVersion(1, 3);
  const bytes = await protectPdf(asFile(await doc.save()), 'Correct-123!');
  expect(execFileSync('pdfinfo', ['-upw', 'Correct-123!', outputPath(bytes)], { encoding: 'utf8' })).toMatch(/algorithm:AES/);
});

test('protection encrypts attachment names, direct form values and stream dictionary strings', async () => {
  const { PDFName, PDFHexString, PDFRef, PDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  page.node.set(PDFName.of('PrivateNote'), PDFHexString.fromText('SECRET page'));
  const privateStream = doc.context.stream(new Uint8Array([65, 66, 67]), { PrivateNote: PDFHexString.fromText('SECRET stream') });
  doc.catalog.set(PDFName.of('PrivateStream'), doc.context.register(privateStream));
  const form = doc.getForm().createTextField('private'); form.setText('SECRET form');
  form.addToPage(page, { x: 20, y: 200, width: 120, height: 20 });
  // Nonzero generation objects cannot be placed in compressed object streams.
  // A legal form with such a ref must not leak its strings when encrypted.
  const newRef = PDFRef.of(form.ref.objectNumber, 1);
  doc.context.assign(newRef, form.acroField.dict);
  for (const widget of form.acroField.getWidgets()) widget.dict.set(PDFName.of('Parent'), newRef);
  doc.getForm().acroForm.dict.set(PDFName.of('Fields'), doc.context.obj([newRef]));
  doc.context.delete(form.ref);
  await doc.attach(new Uint8Array([65, 66, 67]), 'SECRET-attachment.txt', { description: 'SECRET description' });
  const bytes = await protectPdf(asFile(await doc.save({ useObjectStreams: false })), 'Correct-123!');
  const path = outputPath(bytes);
  // Plain and UTF-16BE hex encodings must not survive in the encrypted file.
  const raw = Buffer.from(bytes).toString('latin1');
  for (const value of ['SECRET page', 'SECRET form', 'SECRET-attachment.txt', 'SECRET description', 'SECRET stream']) {
    expect(raw).not.toContain(value);
    const hex = 'feff' + Array.from(value).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
    expect(raw.toLowerCase()).not.toContain(hex);
  }
  expect(execFileSync('pdfdetach', ['-upw', 'Correct-123!', '-list', path], { encoding: 'utf8' })).toContain('SECRET-attachment.txt');
  const output = await unlockPdf(asFile(bytes), 'Correct-123!');
  const parsed = await PDFDocument.load(output);
  expect(parsed.getForm().getTextField('private').getText()).toBe('SECRET form');
  expect(parsed.getPages()[0].node.lookup(PDFName.of('PrivateNote'), PDFHexString).decodeText()).toBe('SECRET page');
  expect(parsed.catalog.lookup(PDFName.of('PrivateStream'), PDFRawStream).dict.lookup(PDFName.of('PrivateNote'), PDFHexString).decodeText()).toBe('SECRET stream');
});


test('unlock preserves delimiters and backslashes from independently encrypted literal strings', async () => {
  const bytes = new Uint8Array(Buffer.from(readFileSync(join(process.cwd(), 'tests/fixtures/encrypted-literal.b64'), 'utf8'), 'base64'));
  const title = String.raw`Customer \name (private) / close )`;
  expect(execFileSync('pdfinfo', ['-upw', 'Correct-123!', outputPath(bytes)], { encoding: 'utf8' })).toContain(title);
  const output = await unlockPdf(asFile(bytes), 'Correct-123!');
  const info = spawnSync('pdfinfo', [outputPath(output)], { encoding: 'utf8' });
  expect(info.status).toBe(0);
  expect(info.stderr.trim()).toBe('');
  expect(info.stdout).toContain(title);
  const parsed = await PDFDocument.load(output);
  expect(parsed.getTitle()).toBe(title);
});
