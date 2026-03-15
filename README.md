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

- Node.js 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

## Run locally

```sh
# Install dependencies
npm i

# Start development server (with hot reload)
npm run dev
```

Then open the URL shown (e.g. `http://localhost:8080`).

### Optional: Supabase (contact form, etc.)

Create a `.env` in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Start dev server         |
| `npm run build`   | Production build         |
| `npm run preview` | Serve production build   |
| `npm run lint`    | Run ESLint               |

## Deploy

Build the app with `npm run build` and deploy the `dist` folder to any static host (Vercel, Netlify, GitHub Pages, etc.).
