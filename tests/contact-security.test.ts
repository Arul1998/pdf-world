import { expect, test } from 'vitest';
import { validateContact, escapeHtml } from '../supabase/functions/send-contact-email/validation';
const valid = { name: 'Arul', email: 'arul@example.com', subject: 'Feedback', message: 'Useful app', token: 'verified-token' };
test('validates and trims a contact submission', () => {
  expect(validateContact({ ...valid, name: ' Arul ' }).name).toBe('Arul');
});
test.each([null, [], { ...valid, email: 'bad' }, { ...valid, name: 123 }, { ...valid, message: 'x'.repeat(5001) }, { ...valid, token: '' }])('rejects malformed or oversized contact input %#', value => {
  expect(() => validateContact(value)).toThrow();
});
test('escapes HTML and attribute delimiters in email content', () => {
  expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});
