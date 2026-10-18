import JSZip from 'jszip';
type ConvertedFile = { name: string; data: Uint8Array | Blob };
export async function createBatchArchive<T>(items: T[], convert: (item: T, index: number) => Promise<ConvertedFile>) {
  const zip = new JSZip();
  const used = new Set<string>(['_conversion-results.json']);
  const failures: { index: number; error: string }[] = [];
  let succeeded = 0;
  for (let index = 0; index < items.length; index++) {
    try {
      const output = await convert(items[index], index);
      const original = output.name.replace(/[\\/]/g, '_');
      let name = original;
      let counter = 2;
      while (used.has(name)) {
        const dot = original.lastIndexOf('.');
        name = dot > 0 ? `${original.slice(0, dot)}_${counter++}${original.slice(dot)}` : `${original}_${counter++}`;
      }
      used.add(name);
      zip.file(name, output.data);
      succeeded++;
    } catch (error) {
      failures.push({ index: index + 1, error: error instanceof Error ? error.message : 'Conversion failed' });
    }
  }
  if (succeeded === 0) throw new Error('No files were converted. Check the files and try again.');
  zip.file('_conversion-results.json', JSON.stringify({ succeeded, failed: failures.length, failures }, null, 2));
  return { data: await zip.generateAsync({ type: 'uint8array' }), succeeded, failed: failures.length };
}
