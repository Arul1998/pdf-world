import { createContactHandler } from './handler.ts';
Deno.serve(createContactHandler({
  apiKey: Deno.env.get('RESEND_API_KEY'),
  toEmail: Deno.env.get('CONTACT_TO_EMAIL'),
  fromEmail: Deno.env.get('CONTACT_FROM_EMAIL'),
  turnstileSecret: Deno.env.get('TURNSTILE_SECRET_KEY'),
  allowedOrigin: Deno.env.get('CONTACT_ALLOWED_ORIGIN'),
}));
