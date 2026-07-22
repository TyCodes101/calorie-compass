# Security

- Provider and OpenAI credentials are server-only environment variables.
- No provider call originates from Swift or a client bundle.
- Provider origins and paths are fixed and validated.
- Query lengths, identifiers, result counts, retries, and timeouts are bounded.
- External JSON and barcode metadata are untrusted until schema and identity validation pass.
- Errors expose sanitized categories, not response bodies or credentials.
- `.env.local` and secret-bearing variants remain ignored.
- CI uses mocks and sentinel credentials.
- Secret scanning runs before build and release.

Development diagnostics are disabled in production by code, not only configuration. The branch does not rotate credentials. Any credential previously pasted into chat, an issue, or Git history should be revoked and replaced by its owner.
