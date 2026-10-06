import { validateContact, escapeHtml } from './validation.ts';
export interface ContactConfig {
  apiKey?: string;
  toEmail?: string;
  fromEmail?: string;
  turnstileSecret?: string;
  allowedOrigin?: string;
}
export function createContactHandler(config: ContactConfig, request: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    };
    const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });
    if (!config.apiKey || !config.toEmail || !config.fromEmail || !config.turnstileSecret || !config.allowedOrigin) return reply(503, 'Contact service is unavailable.');
    if (req.headers.get('origin') !== config.allowedOrigin) return reply(403, 'Origin is not allowed.');
    headers['Access-Control-Allow-Origin'] = config.allowedOrigin;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return reply(405, 'Use POST.');
    if (!req.headers.get('content-type')?.includes('application/json')) return reply(415, 'Use JSON.');
    try {
      // Count actual streamed bytes; do not trust client-supplied Content-Length.
      const reader = req.body?.getReader();
      if (!reader) return reply(400, 'Invalid submission.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32_768) { await reader.cancel(); return reply(413, 'Submission is too large.'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let submission;
      try { submission = validateContact(JSON.parse(new TextDecoder().decode(bytes))); }
      catch { return reply(400, 'Invalid contact details. Check the fields and verification.'); }
      const verification = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: config.turnstileSecret, response: submission.token }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!verification.ok) return reply(503, 'Verification service is unavailable.');
      const result = await verification.json();
      if (result.success !== true || result.hostname !== new URL(config.allowedOrigin).hostname || result.action !== 'contact') return reply(403, 'Verification failed. Please try again.');
      const response = await request('https://api.resend.com/emails', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          from: config.fromEmail, to: [config.toEmail], reply_to: submission.email,
          subject: submission.subject || `Contact from ${submission.name}`,
          text: `${submission.name}\n${submission.email}\n\n${submission.message}`,
          html: `<h1>PDF World contact</h1><p>${escapeHtml(submission.name)}</p><p>${escapeHtml(submission.email)}</p><p>${escapeHtml(submission.message).replace(/\n/g, '<br />')}</p>`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return reply(502, 'Unable to send message. Please try again later.');
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    } catch {
      return reply(503, 'Contact service is temporarily unavailable.');
    }
  };
}
