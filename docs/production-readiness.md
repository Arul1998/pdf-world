# PDF World production readiness

This branch prepares a limited browser-only beta. It does not certify all 35 tools as production-ready.

## Decisions

- Keep document processing local. DOCX, PPTX and HTML exports explicitly disclose text-only output; faithful Office rendering requires a separate engine decision.
- PDF/A is disabled until an actual compliant converter passes independent validation. The old metadata simulation is removed.
- The generic Office route links to dedicated exports; it no longer generates placeholder slides.
- Contact is optional and fails closed unless both backend and CAPTCHA configuration are present. It does not attach documents.
- Shared file picker defaults: 20 files, 50 MiB each, 100 MiB combined. These are input limits, not a guarantee of sufficient device memory.

## Verification limitations

Chromium was unavailable locally and downloading it returned invalid archives. Local browser checks could not be completed; jsdom tests are not a replacement. The dependency audit reported advisories in existing packages, including the spreadsheet parser. After updating the Vite/Vitest/PWA/SWC toolchain and applying compatible fixes, the audit reports 17 findings (8 moderate, 8 high, 1 critical). Remaining affected dependencies include Fabric, SheetJS, Tailwind, React Router, Mammoth and transitive tar. Major migrations need browser regression checks. Dependency migration is a launch gate; do not interpret a passing build as a clean security audit.

## Phase status

| Phase | Implemented | Remaining launch gate |
| --- | --- | --- |
| 1 Foundation | Lint errors fixed; typecheck/test/check scripts; CI; safe optional backend; Vercel SPA routing and security headers | Confirm checks on the remote branch and routing on the chosen production host |
| 2 Correctness | Removed false PDF/A and generic Office output; disclosed limited conversions; legacy DOC/PPT rejected in dedicated pickers; honest batch summaries | Faithful Office conversion and validated PDF/A require a converter decision |
| 3 Output/security | Regression tests for merge/split/extract/rotate/copy, invalid selections; contact validation, HTML escaping, token verification | Independent readers, forms/annotations/digital signatures, rotated redaction, passwords, Unicode and scanned documents |
| 4 Performance | Aggregate picker limits and overlapping selection guard; duplicate archive names retained and failure reports in Word-to-PDF, PPTX-to-PDF and PDF-to-PPTX conversion ZIPs | Mobile memory profiling, page/pixel budgets, cancellation, complete worker/canvas cleanup |
| 5 Public experience | Privacy wording and contact fail-closed behaviour; accessibility labels; deployment configuration | Production email/CAPTCHA configuration, distributed rate limiting, keyboard/device sweep, offline OCR/update tests |
| 6 Beta | CI and reproducible local checks | Staging URL, privacy-conscious monitoring configuration, real beta feedback, rollback rehearsal |

## Verify locally

Use Node 22.12+ (22 LTS), 24, or 26+. Run `npm ci`, then `npm run check`.
UI tests use jsdom and replace the PDF rendering module only where no rendering occurs. PDF operation tests use real generated PDF documents. Contact handler tests inject network responses; no real email is sent. These do not substitute for browser/output testing.

## Contact configuration

Frontend build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY`.

Function secrets: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (a verified sending address), `TURNSTILE_SECRET_KEY`, `CONTACT_ALLOWED_ORIGIN` (exact origin, e.g. `https://pdfworld.app`, no trailing slash).

Use a Turnstile site restricted to the production hostname. The widget action is `contact`; the server checks success, hostname and action. Missing/expired/reused tokens must fail. Publishable API keys are not JWTs: the public function has `verify_jwt = false` and enforces Turnstile itself. Never put secret keys in VITE variables. Deploy the function separately from static assets. Verify actual delivery to the configured inbox before enabling Contact.

Turnstile protects email submission but is not a distributed rate limiter. Configure rate limits at an upstream gateway or persistent store and email provider spending controls before a broad public launch. CORS is not authentication.

## Manual acceptance collection

For every visible tool test: text PDFs, image-only scans, password-protected inputs, damaged files, rotated and mixed-size pages, AcroForms, annotations, links, digitally signed documents, Tamil/Unicode, large PDFs, and mixed successful/failed batches. Record supported behaviour and explicitly disclose destructive transformations.

Redaction: mark text and images on rotated/cropped pages, inspect rendered output, extract all output text, and search decoded streams/attachments for the original sensitive data. Verify with independent readers. Passwords: correct, incorrect and empty password; independent reader opening; encryption variants; form/annotation preservation. Compression/repair: explain flattening and verify page count and appearance.

Offline: install the PWA, load core tools, disconnect, process/download fixtures, reopen, reconnect and verify update behaviour. OCR needs engine/language downloads; do not promise full offline OCR without testing cached resources.

Rollback: retain the last known-good static build and function version, document how to redeploy both, and test the procedure on staging. Do not merge or publish this branch until outstanding gates are reviewed.

## Deferred review items

- Existing PDF-to-Word and other unmigrated batch paths can still overwrite duplicate output names; shared archive improvements currently cover only the three named converters.
- Seven shadcn development-only Fast Refresh warnings remain. Hook dependency warnings were addressed without disabling the hook rules.
- Automated redaction/password/Unicode and OCR output tests are still missing; this branch does not certify those tools for sensitive documents.
