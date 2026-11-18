# Fixtures

The real memos and their snapshots are **not** committed. They contain customer names,
phone numbers and addresses, and this repo is public.

To run the full regression suite locally:

1. Put the `Cash Memo Bulk PDFs` in this folder.
2. `npm run snapshots` writes `test/expected/*.json`.
3. `npm test` checks every sort/address combination and reads the generated PDFs back.

Without fixtures, `npm test` skips only those memo checks. The address rules, empty PDF
and CSV tests still run.
