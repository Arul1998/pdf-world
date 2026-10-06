import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
test('contact renders a useful fallback without backend configuration', async () => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
  vi.resetModules();
  const { default: Contact } = await import('../src/pages/Contact');
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Contact /></MemoryRouter>);
  expect(screen.getByText(/contact form is currently unavailable/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /send message/i }).hasAttribute('disabled')).toBe(true);
});
test('malformed optional backend URL also shows the unavailable state', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'example-key');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'example-site-key');
  vi.resetModules();
  const { default: Contact } = await import('../src/pages/Contact');
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Contact /></MemoryRouter>);
  expect(screen.getByText(/contact form is currently unavailable/i)).toBeTruthy();
});
