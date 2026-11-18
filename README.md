# delivery-list

Indane "Cash Memo Bulk" PDF -> clean A4 delivery list PDF. Everything runs offline:
`pdfjs-dist` reads the memo, `pdf-lib` writes the list. No AI, no account, and the memo
never leaves the browser.

The deployed site uses Vercel Analytics for anonymous page counts. It never sees the memo,
the extracted rows or a downloaded list.

## Web app

Upload one or more memos, preview the rows, then download a PDF or CSV. Conversion happens
in the browser, so the site is a static export and needs no server or edge function.
Downloads are named `Delivery-List-YYYY-MM-DD.pdf` (or `.csv`).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in out/
```

Deploy on Vercel: import the repo, keep the Next.js preset, build with `npm run build`.
Vercel serves the static `out/` folder. Any static host works the same way. The production
domain is picked up automatically for canonical and Open Graph URLs; set
`NEXT_PUBLIC_SITE_URL` if you host it elsewhere.

## CLI

```bash
npm run cli -- "Cash Memo Bulk.PDF"
npm run cli -- memo.PDF --out=delivery.pdf --sort=area --parts=2 --title="Delivery List"
```

| Option | Meaning |
| --- | --- |
| `--out=<file\|dir>` | One output file, or a directory for several inputs (default `output/`) |
| `--sort=memo\|area\|name` | Row order (default `memo`) |
| `--parts=1..5` | Address parts to keep (default `3`) |
| `--title=<text>` | Heading printed on the PDF |
| `--no-group` | Hide area bands when sorting by area |

## Tests and samples

```bash
npm test           # address rules, every sort/parts combo, exact rows and rendered PDFs
npm run samples    # writes PDFs to output/<memo>/ plus output/manifest.json
```

The three memos in `test/` (32, 37 and 66 entries) are the fixtures. They are real customer
memos, so they and their snapshots stay out of git. See `test/README.md` to run the full
suite locally.

## Layout

- `src/core/` - address cleaning, memo parsing, row building, PDF rendering (shared by CLI and browser)
- `src/node/` - Node-side PDF text extraction
- `src/cli.ts` - command line entry point
- `lib/browser-extract.ts` - browser-side PDF text extraction
- `app/`, `components/` - the web app

Payment is `Online` when Net Payable is 0, otherwise `Cash`. Missing or cut-off fields are kept
as they appear in the memo and reported as warnings.

---

Made with love by [@dhirajaryaa](https://github.com/dhirajaryaa).
