# East Coast Big Playas 2025 Archive

This directory is the preserved source for the 2025 tournament site. It is an
archive, not the live 2026 application: do not point a new tournament at this
code or let it overwrite a newer tournament dataset.

## Snapshot on hand

- Source commit: `9f592ae5152cb85000d9ada8b222403436cc6621`
- Checked-in data: `tournament-data.json`
- SHA-256: `a40897a0a264794fd6087b0939c74e45d0c4d19912f09cf42bdc81166763d052`
- Last known production deployment: `golf-project-5si5nwbar-james-projects-cf25d43f.vercel.app`

The checked-in snapshot contains partial final-event data. The production API is
still present but protected by Vercel SSO; when Vercel access is restored, export
the live `golf-tournament-data` value and preserve it beside this snapshot with
its retrieval date and checksum. Do not replace this file in place.

## Archive behavior

When deployed as the archive, all data must be served read-only. Disable score
entry and saving, label the UI **2025 Archive — Final Results**, and ensure it
uses a frozen snapshot rather than a live KV/Redis connection.
