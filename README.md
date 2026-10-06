# PDF World

Free online PDF tools: merge, split, compress, rotate, convert, edit, and secure PDFs. All processing runs in your browser—your files never leave your device.

## Tech stack

- **Vite** – build tool
- **TypeScript** – type safety
- **React** – UI
- **shadcn-ui** – components
- **Tailwind CSS** – styling
- **Supabase** – optional backend (e.g. contact form)

## Prerequisites

- Node.js 22.12+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

## Run locally

```sh
# Install dependencies
npm i

# Start development server (with hot reload)
npm run dev
```

Then open the URL shown (e.g. `http://localhost:8080`).

### Optional: Supabase (contact form, etc.)

Copy `.env.example` to `.env` and fill in your own values (never commit `.env`):

```env
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

For the contact edge function, set these **Supabase function secrets** (Dashboard → Edge Functions → Secrets), not in the repo:

- `RESEND_API_KEY` — Resend API key
- `CONTACT_TO_EMAIL` — inbox that receives contact form submissions
- `CONTACT_FROM_EMAIL` — verified sending address
- `TURNSTILE_SECRET_KEY` — server-side anti-bot verification secret
- `CONTACT_ALLOWED_ORIGIN` — exact permitted website origin

Set `VITE_TURNSTILE_SITE_KEY` in the frontend build to enable Contact. Without configuration the PDF tools work and Contact displays an unavailable message.

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Start dev server         |
| `npm run build`   | Production build         |
| `npm run preview` | Serve production build   |
| `npm run lint`    | Run ESLint               |

## Deploy

Build the app with `npm run build` and deploy the `dist` folder to any static host (Vercel, Netlify, GitHub Pages, etc.).

## Quality and release checks

Run `npm run check` for lint, TypeScript, regression tests and the production build.
GitHub Actions runs these checks on pull requests and main.

See [production readiness](docs/production-readiness.md) for supported conversion limits,
contact configuration, manual acceptance tests, and remaining launch gates. PDF/A conversion
is not available. Word, PowerPoint and HTML exports do not preserve original layout.
Vercel routing is configured in `vercel.json`; other hosts need an equivalent SPA fallback.

Security/output regression tests require Poppler utilities (`pdftotext`, `pdfinfo`, `pdfdetach`, `pdftoppm`). On Ubuntu install `poppler-utils`; CI installs them automatically. See [phase-two work](docs/phase-two-security.md) and [remaining launch gates](docs/production-readiness.md).
