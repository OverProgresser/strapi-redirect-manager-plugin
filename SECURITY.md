# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this plugin, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email the maintainer at **safasener@marun.edu.tr** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. A fix will be developed privately and released as a patch version.

## Security Model

- All admin API routes require a valid Strapi admin JWT (`type: 'admin'`).
- No public (`content-api`) endpoints are exposed.
- `from` and `to` fields must be absolute paths starting with `/`. External URLs, protocol-relative URLs (`//`), and reserved Strapi paths are rejected.
- The runtime middleware only issues redirects to internal paths — cached entries with `http://` or `https://` targets are skipped.
- Error responses never expose stack traces or internal file paths.
