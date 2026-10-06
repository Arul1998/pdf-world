# Phase two: security and output acceptance

Work on `main`, as requested. This phase does not deploy the application.

1. Password tools: reject empty protection passwords and already encrypted inputs, remove encryption without losing document-level forms/attachments, and fail rather than silently rasterizing unsupported inputs. Verify generated files using Poppler independently of the writing library. Test correct, incorrect and empty passwords; reject Unicode/overlong passwords explicitly because this AES-128 path supports only 4–32 printable ASCII characters.
2. Redaction: validate every selected area, fail on missing canvas or invalid pages, use lossless raster output and bounded page/pixel budgets, and release resources. Verify rotated/cropped pages, masks, missing text, annotations, attachments and metadata. Explain intentional flattening in the UI.
3. Runtime dependencies: upgrade Fabric and React Router with regression checks; install maintained SheetJS from its official distribution if accessible. Record remaining audit findings honestly; do not force unrelated incompatible build-tool migrations.
4. Fix password-tool batch accounting and duplicate output names. Run lint, types, full tests, production build and dependency audit; review changes before publishing focused commits to main.

Remaining gates: a real browser/device sweep, memory profiling, offline OCR, digital-signature handling, production contact configuration/rate limiting, staging feedback and rollback rehearsal. Faithful Office rendering and validated PDF/A still need a converter decision.

Implemented: password/redaction output guards, independent Poppler checks, duplicate-safe password archives, corrected success counts, Fabric/Router upgrades and maintained SheetJS distribution. Clean `npm ci` passed. Lint (0 errors, 7 existing warnings), typecheck, all 53 tests and the production build passed. Browser/device acceptance and live deployment remain unverified. Remaining audit: 11 findings (6 moderate, 5 high, no critical).

Review fixes: encrypt dictionary strings in catalog/page/stream/nonzero-generation objects using the engine’s owning-object cipher; normalize decrypted literal bytes to hex before writing. Pin the engine version because this adapter matches its writer implementation. Independent fixtures prove encrypted attachment/form metadata is not exposed and delimiters/backslashes survive unlocking.
