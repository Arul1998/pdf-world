export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  token: string;
}
export function validateContact(input: unknown): ContactRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid submission.');
  const data = input as Record<string, unknown>;
  const field = (name: string, max: number, required = true) => {
    const value = data[name];
    if (typeof value !== 'string') throw new Error(`Invalid ${name}.`);
    const trimmed = value.trim();
    if ((required && !trimmed) || trimmed.length > max) throw new Error(`Invalid ${name}.`);
    return trimmed;
  };
  const email = field('email', 254);
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) throw new Error('Invalid email.');
  return { name: field('name', 100), email, subject: field('subject', 200, false), message: field('message', 5000), token: field('token', 2048) };
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
