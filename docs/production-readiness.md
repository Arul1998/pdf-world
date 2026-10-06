# PDF World production readiness

This branch prepares a limited browser-only beta. It does not certify all 35 tools as production-ready.

## Decisions

- Keep document processing local. DOCX, PPTX and HTML exports explicitly disclose text-only output; faithful Office rendering requires a separate engine decision.
- PDF/A is disabled until an actual compliant converter passes independent validation. The old metadata simulation is removed.
- The generic Office route links to dedicated exports; it no longer generates placeholder slides.
- Contact is optional and fails closed unless both backend and CAPTCHA configuration are present. It does not attach documents.
- Shared file picker defaults: 20 files, 50 MiB each, 100 MiB combined. These are input limits, not a guarantee of sufficient device memory.

## Verification limitations

Chromium was unavailable locally and downloading it returned invalid archives. Local browser checks could not be completed; jsdom and native canvas checks are not browser/device certification. Phase two upgrades Fabric to 7.4, React Router to 7.18, jsdom to 26.1, and SheetJS to the maintained 0.20.3 tarball from its official CDN, with lockfile integrity verification. Editor origin compatibility and spreadsheet import have regression checks. The dependency audit now reports 11 findings (6 moderate, 5 high, 0 critical), down from 17. Remaining paths include Tailwind/glob/selector parsing and Mammoth/argparse/sprintf. These require separate tested migrations or upstream fixes; a passing build is not a clean security audit.

The encryption engine is pinned to `@cantoo/pdf-lib` 2.8.1: an adapter encrypts strings in uncompressed objects and serializes decrypted literal bytes as hex, fixing library defects that leaked attachment names/direct form values and malformed escaped metadata. Updating this engine requires repeating the independent regression collection.

Independent Poppler tools now verify password opening, AES selection for older inputs, searchable unlocked output, forms/attachments, rotated/cropped redaction masks and absence of original text/metadata/attachments in flattened exports. Redaction uses lossless PNGs, validates every area, fails rather than skipping pages, and enforces 100 pages, 16 million pixels per page and 64 million total pixels in preview/export. These are conservative guards, not measured device memory guarantees.

## Phase status

| Phase | Implemented | Remaining launch gate |
| --- | --- | --- |
| 1 Foundation | Lint errors fixed; typecheck/test/check scripts; CI; safe optional backend; Vercel SPA routing and security headers | Confirm checks on the remote branch and routing on the chosen production host |
| 2 Correctness | Removed false PDF/A and generic Office output; disclosed limited conversions; legacy DOC/PPT rejected in dedicated pickers; honest batch summaries | Faithful Office conversion and validated PDF/A require a converter decision |
| 3 Output/security | Regression tests for merge/split/extract/rotate/copy, invalid selections; contact validation, HTML escaping, token verification | Broader encryption variants, annotations/digital signatures, Unicode document content and scanned documents; independent password/redaction fixture checks are implemented |
| 4 Performance | Aggregate picker limits and overlapping selection guard; duplicate archive names retained and failure reports in Word-to-PDF, PPTX-to-PDF and PDF-to-PPTX conversion ZIPs | Mobile memory profiling, page/pixel budgets, cancellation, cleanup/cancellation across remaining tools; redaction and its preview now release resources |
| 5 Public experience | Privacy wording and contact fail-closed behaviour; accessibility labels; deployment configuration | Production email/CAPTCHA configuration, distributed rate limiting, keyboard/device sweep, offline OCR/update tests |
| 6 Beta | CI and reproducible local checks | Staging URL, privacy-conscious monitoring configuration, real beta feedback, rollback rehearsal |

## Verify locally

Use Node 22.12+ (22 LTS), 24, or 26+. Install Poppler utilities (`pdftotext`, `pdfinfo`, `pdfdetach`, `pdftoppm`; Ubuntu: `sudo apt-get install poppler-utils`). Run `npm ci`, then `npm run check`. CI installs these independent output validators; the native canvas test adapter is an explicit development dependency.
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
- Automated password and rotated/cropped redaction fixtures now exist. Unicode document content, more encryption variants and OCR output tests remain; fixture checks do not certify every sensitive document.
- Protection supports 4–32 printable ASCII characters and uses AES-128; unsupported passwords fail clearly. Unlocking preserves catalog-level features when parseable and fails explicitly instead of flattening unsupported inputs. Re-saving invalidates signatures.
- Password batch exports now preserve duplicate filenames and include a results report; unsuccessful unlocks never show a success page.
