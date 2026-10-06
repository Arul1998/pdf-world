// @vitest-environment node
import { expect, test } from 'vitest';
import { createContactHandler, type ContactConfig } from '../supabase/functions/send-contact-email/handler';
const config: ContactConfig = { apiKey: 'test-key', toEmail: 'owner@example.com', fromEmail: 'PDF World <contact@example.com>', turnstileSecret: 'secret', allowedOrigin: 'https://pdfworld.app' };
const valid = { name: '<script>', email: 'arul@example.com', subject: 'Hello', message: '<img src=x>', token: 'test-token' };
const submission = (body: unknown = valid, origin = 'https://pdfworld.app') => new Request('https://functions.example/contact', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('unconfigured contact service fails closed', async () => {
  expect((await createContactHandler({})(submission())).status).toBe(503);
});
test('rejects cross-origin requests', async () => {
  expect((await createContactHandler(config)(submission(valid, 'https://attacker.example'))).status).toBe(403);
});
test('rejects non-string fields without leaking errors', async () => {
  expect((await createContactHandler(config)(submission({ ...valid, name: 42 }))).status).toBe(400);
});
test('counts actual request bytes rather than trusting Content-Length', async () => {
  expect((await createContactHandler(config)(submission({ ...valid, message: 'x'.repeat(40_000) }))).status).toBe(413);
});
test.each([
  { success: false, hostname: 'pdfworld.app', action: 'contact' },
  { success: true, hostname: 'attacker.example', action: 'contact' },
  { success: true, hostname: 'pdfworld.app', action: 'login' },
])('rejects invalid verification result %#', async result => {
  const network: typeof fetch = async () => Response.json(result);
  expect((await createContactHandler(config, network)(submission())).status).toBe(403);
});
test('sends escaped content only after successful verification', async () => {
  let outgoing: Record<string, string> | undefined;
  const network: typeof fetch = async (url, options) => {
    if (String(url).includes('siteverify')) return Response.json({ success: true, hostname: 'pdfworld.app', action: 'contact' });
    outgoing = JSON.parse(options!.body as string);
    return Response.json({ id: 'email-id' });
  };
  const response = await createContactHandler(config, network)(submission());
  expect(response.status).toBe(200);
  expect(outgoing!.html).toContain('&lt;img src=x&gt;');
  expect(outgoing!.html).not.toContain('<script>');
  expect(outgoing!.reply_to).toBe(valid.email);
});
test('does not expose provider errors', async () => {
  const network: typeof fetch = async url => String(url).includes('siteverify') ? Response.json({ success: true, hostname: 'pdfworld.app', action: 'contact' }) : Response.json({ message: 'sensitive provider detail' }, { status: 500 });
  const response = await createContactHandler(config, network)(submission());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('sensitive');
});
