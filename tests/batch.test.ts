// @vitest-environment node
import { expect, test } from 'vitest';
import JSZip from 'jszip';
import { createBatchArchive } from '../src/lib/batch';
test('reports partial failures and preserves outputs with duplicate names', async () => {
  const batch = await createBatchArchive(['good', 'bad', 'good'], async item => {
    if (item === 'bad') throw new Error('Cannot convert');
    return { name: 'same.pdf', data: new Uint8Array([1, 2]) };
  });
  expect(batch.succeeded).toBe(2);
  expect(batch.failed).toBe(1);
  const archive = await JSZip.loadAsync(batch.data);
  expect(Object.keys(archive.files)).toEqual(['same.pdf', 'same_2.pdf', '_conversion-results.json']);
  expect(JSON.parse(await archive.file('_conversion-results.json')!.async('string')).failures).toHaveLength(1);
});
test('does not download an empty success archive when every file fails', async () => {
  await expect(createBatchArchive(['bad'], async () => { throw new Error('Cannot convert'); })).rejects.toThrow(/no files were converted/i);
});
