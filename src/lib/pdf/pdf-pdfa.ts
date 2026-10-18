import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { pdfjsLib } from './pdfjs-setup';
import { readFileAsArrayBuffer } from './pdf-core';
import { addRasterPage, renderPageToJpeg } from './pdf-raster';

export type PdfALevel = 'pdfa-1b' | 'pdfa-2b' | 'pdfa-3b';

const PDFA_PART: Record<PdfALevel, number> = {
  'pdfa-1b': 1,
  'pdfa-2b': 2,
  'pdfa-3b': 3,
};

// ---------------------------------------------------------------------------
// sRGB ICC profile (v2.1, display class, matrix/TRC). PDF/A requires an
// OutputIntent carrying an ICC profile that matches the DeviceRGB page images.
// Built in code so we don't have to ship a binary asset.
// ---------------------------------------------------------------------------

class ByteWriter {
  private bytes: number[] = [];
  get length() {
    return this.bytes.length;
  }
  u8(v: number) {
    this.bytes.push(v & 0xff);
  }
  u16(v: number) {
    this.u8(v >> 8);
    this.u8(v);
  }
  u32(v: number) {
    this.u16(v >>> 16);
    this.u16(v & 0xffff);
  }
  s15f16(v: number) {
    this.u32(Math.round(v * 65536) >>> 0);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  zeros(n: number) {
    for (let i = 0; i < n; i++) this.u8(0);
  }
  align4() {
    while (this.bytes.length % 4) this.u8(0);
  }
  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

const buildSrgbIccProfile = (): Uint8Array => {
  const description = 'sRGB IEC61966-2.1';

  const desc = new ByteWriter();
  desc.ascii('desc');
  desc.zeros(4);
  desc.u32(description.length + 1);
  desc.ascii(description);
  desc.u8(0);
  desc.zeros(4 + 4); // Unicode language code + count
  desc.zeros(2 + 1 + 67); // ScriptCode code, count, and fixed 67-byte field

  const cprt = new ByteWriter();
  cprt.ascii('text');
  cprt.zeros(4);
  cprt.ascii('No copyright, use freely');
  cprt.u8(0);

  const xyz = (x: number, y: number, z: number) => {
    const w = new ByteWriter();
    w.ascii('XYZ ');
    w.zeros(4);
    w.s15f16(x);
    w.s15f16(y);
    w.s15f16(z);
    return w;
  };

  // Sampled sRGB transfer curve.
  const trc = new ByteWriter();
  const samples = 1024;
  trc.ascii('curv');
  trc.zeros(4);
  trc.u32(samples);
  for (let i = 0; i < samples; i++) {
    const c = i / (samples - 1);
    const linear = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    trc.u16(Math.round(linear * 65535));
  }

  // Bradford-adapted (D50) sRGB primaries.
  const tags: [string, ByteWriter][] = [
    ['desc', desc],
    ['cprt', cprt],
    ['wtpt', xyz(0.9642, 1.0, 0.8249)],
    ['rXYZ', xyz(0.4360747, 0.2225045, 0.0139322)],
    ['gXYZ', xyz(0.3850649, 0.7168786, 0.0971045)],
    ['bXYZ', xyz(0.1430804, 0.0606169, 0.7141733)],
    ['rTRC', trc],
    ['gTRC', trc],
    ['bTRC', trc],
  ];

  // Lay out tag data after header (128) + tag table; shared data is written once.
  const tableSize = 4 + tags.length * 12;
  const offsets = new Map<ByteWriter, number>();
  let cursor = 128 + tableSize;
  const unique: ByteWriter[] = [];
  for (const [, data] of tags) {
    if (offsets.has(data)) continue;
    cursor = Math.ceil(cursor / 4) * 4;
    offsets.set(data, cursor);
    unique.push(data);
    cursor += data.length;
  }
  const totalSize = Math.ceil(cursor / 4) * 4;

  const out = new ByteWriter();
  const now = new Date();
  out.u32(totalSize);
  out.zeros(4); // preferred CMM
  out.u32(0x02100000); // version 2.1
  out.ascii('mntr');
  out.ascii('RGB ');
  out.ascii('XYZ ');
  out.u16(now.getUTCFullYear());
  out.u16(now.getUTCMonth() + 1);
  out.u16(now.getUTCDate());
  out.u16(now.getUTCHours());
  out.u16(now.getUTCMinutes());
  out.u16(now.getUTCSeconds());
  out.ascii('acsp');
  out.zeros(4 + 4 + 4 + 4 + 8); // platform, flags, manufacturer, model, attributes
  out.u32(0); // perceptual rendering intent
  out.s15f16(0.9642); // D50 illuminant
  out.s15f16(1.0);
  out.s15f16(0.8249);
  out.zeros(4); // creator
  out.zeros(128 - out.length);

  out.u32(tags.length);
  for (const [sig, data] of tags) {
    out.ascii(sig);
    out.u32(offsets.get(data)!);
    out.u32(data.length);
  }
  for (const data of unique) {
    out.align4();
    const bytes = data.toUint8Array();
    for (const b of bytes) out.u8(b);
  }
  out.align4();

  return out.toUint8Array();
};

// ---------------------------------------------------------------------------
// XMP metadata. Every Info dictionary entry we write is mirrored here, as
// PDF/A requires the two to agree.
// ---------------------------------------------------------------------------

// The XMP packet header must carry a byte-order mark.
const BOM = String.fromCharCode(0xfeff);

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const buildXmp = (opts: {
  part: number;
  title: string;
  creatorTool: string;
  producer: string;
  date: Date;
}): string => {
  const iso = opts.date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `<?xpacket begin="${BOM}" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(opts.title)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <xmp:CreatorTool>${escapeXml(opts.creatorTool)}</xmp:CreatorTool>
      <xmp:CreateDate>${iso}</xmp:CreateDate>
      <xmp:ModifyDate>${iso}</xmp:ModifyDate>
      <xmp:MetadataDate>${iso}</xmp:MetadataDate>
      <pdf:Producer>${escapeXml(opts.producer)}</pdf:Producer>
      <pdfaid:part>${opts.part}</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

const randomHex = (bytes: number) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

// Convert a PDF to PDF/A (level B, visual conformance).
//
// Pages are rasterised to JPEG, which sidesteps the parts of PDF/A that are hard
// to guarantee for arbitrary input (embedded fonts, transparency, forbidden
// actions/annotations). The trade-off: the output has no selectable text.
export const convertToPdfA = async (
  file: File,
  level: PdfALevel,
  onPageProgress?: (currentPage: number, totalPages: number) => void
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const source = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    // updateMetadata: false stops pdf-lib writing its own Producer/Creator,
    // which would then be missing from the XMP packet.
    const doc = await PDFDocument.create({ updateMetadata: false });

    for (let i = 1; i <= source.numPages; i++) {
      onPageProgress?.(i, source.numPages);
      const page = await source.getPage(i);
      await addRasterPage(doc, await renderPageToJpeg(page, 2, 0.92));
    }

    // Second precision so the Info dates and XMP dates are identical.
    const date = new Date(Math.floor(Date.now() / 1000) * 1000);
    const title = file.name.replace(/\.pdf$/i, '');
    const creatorTool = 'PDF World - PDF/A Converter';
    const producer = 'PDF World';

    doc.setTitle(title);
    doc.setCreator(creatorTool);
    doc.setProducer(producer);
    doc.setCreationDate(date);
    doc.setModificationDate(date);

    const { context, catalog } = doc;

    // XMP metadata stream. PDF/A-1 forbids filters on it, so store it raw.
    const xmpBytes = new TextEncoder().encode(
      buildXmp({ part: PDFA_PART[level], title, creatorTool, producer, date })
    );
    const metadataRef = context.register(
      context.stream(xmpBytes, { Type: 'Metadata', Subtype: 'XML' })
    );
    catalog.set(PDFName.of('Metadata'), metadataRef);

    // OutputIntent with an embedded sRGB profile.
    const iccRef = context.register(context.flateStream(buildSrgbIccProfile(), { N: 3 }));
    const outputIntentRef = context.register(
      context.obj({
        Type: 'OutputIntent',
        S: 'GTS_PDFA1',
        OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
        Info: PDFString.of('sRGB IEC61966-2.1'),
        RegistryName: PDFString.of('http://www.color.org'),
        DestOutputProfile: iccRef,
      })
    );
    catalog.set(PDFName.of('OutputIntents'), context.obj([outputIntentRef]));

    // PDF/A requires a file identifier in the trailer.
    const id = PDFHexString.of(randomHex(16));
    context.trailerInfo.ID = context.obj([id, id]);

    // Object streams are not allowed in PDF/A-1; skip them for every level.
    return await doc.save({ useObjectStreams: false });
  } finally {
    await source.destroy();
  }
};
