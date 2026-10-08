# Storage Architecture

## R2 is the canonical file store

All binary uploads (media library, project files, invoices, brand assets, founder image) live in the `ASSETS` R2 bucket bound to the Worker. Database rows in `media` and `project_files` track metadata (filename, mime, size, visibility, ownership, role).

### Key prefixes

| Prefix | Visibility | Owner |
|---|---|---|
| `uploads/<ts>-<rand>-<safe>` | PUBLIC (default for media library) | n/a |
| `brand/` | PUBLIC | role-tagged: `brand_cv`, `founder_image`, `pricing_guide`, `portfolio_highlight` |
| `projects/<projectId>/<ts>-<rand>-<safe>` | PRIVATE (default) or PUBLIC if `media.visibility=PUBLIC` | clientId/projectId |
| `invoices/<invoiceId>/` | PRIVATE | clientId |

A `makeKey(prefix, filename)` helper generates timestamp+random prefixed safe keys.

## Visibility

`media.visibility` and `project_files.visibility` are enums `('PUBLIC','PRIVATE')`:
- **PUBLIC** files have a stable public URL via `R2_PUBLIC_URL` (e.g. `https://assets.toluenetech.com/<key>`) and can be served directly by the R2 public domain or a custom CDN domain. These are portfolio images, public brand assets, founder image, media-library images used by the public site.
- **PRIVATE** files never have stable public URLs. They are served through:
  1. **Signed S3 URLs** (preferred) — generated via HMAC-SHA256 sigv4 against `R2_ENDPOINT` with `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`. TTL 1 hour. Set `R2_BUCKET_NAME` (usually the same as the bucket binding name).
  2. **Worker proxy fallback** — when R2 S3 credentials are not configured, `GET /files/project/:id` streams bytes through the Worker with `Content-Disposition: inline; filename=...` and auth/ownership checks. Works for MVP; move to signed URLs for scale.

## Access control

| Operation | Required auth | Ownership check |
|---|---|---|
| `POST /media/upload` | admin | n/a; upload stamped with `uploadedBy` |
| `GET /files/media/:id` | none if PUBLIC; admin if PRIVATE | none |
| `GET /files/project/:id` | admin OR client | client must own file.projectId (via assertProjectOwnership) |
| `DELETE /admin/media/:id` | admin | deletes both R2 object and DB row |

## Migration from Firebase Storage

Current state (pre-migration): brand assets (CV, pricing guide, portfolio highlight, founder image) are uploaded to Firebase Storage in Settings/Brand and Settings/Founder. Files uploaded via Admin Media library already go to R2.

Migration plan (Phase 2 wiring):
1. Add `media.role` (already added in Phase 1 migration) so brand assets can live in the `media` table with a role tag.
2. Create a one-shot script that downloads each Firebase Storage file, re-uploads to R2, inserts a `media` row with the correct `role`, and updates the Settings page to use the media library picker.
3. Keep Firebase Storage read-only during a transition window; after cutover, remove Firebase Storage dependency.
4. Portal demo files (currently hardcoded `#` links) move to `project_files` rows with R2 keys during Phase 4.

## Upload validation

- MIME allowlist: `image/jpeg, image/png, image/webp, image/gif, image/svg+xml, video/mp4, video/webm, application/pdf, application/zip, text/plain, text/markdown`.
- Hard cap 20 MB per upload (both declared `Content-Length` and actual byte count checked).
- Filenames sanitized to `[^a-zA-Z0-9._-]`, truncated to 120 chars.
- `Content-Type` is taken from the request header; on download it is set from DB metadata (not from user input) to prevent stored-XSS via mime sniffing.

## Security headers on downloads
- `X-Content-Type-Options: nosniff` applied globally via security middleware.
- `Content-Disposition: inline; filename="<sanitized>"` prevents browsers from rendering uploads as the app's origin (except for inlined images which is desired). For binary deliverables (invoices, zip files) consider switching to `attachment` in Phase 5.
