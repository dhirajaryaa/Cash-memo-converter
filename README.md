# delivery-list-offline

Indane "Cash Memo Bulk" PDF -> clean A4 delivery list PDF. Fully offline, no AI, no network.
Libraries: `pdfjs-dist` (PDF read) + `pdf-lib` (PDF write). Nothing else at runtime.

## Run
```
npm install
npm run build
node dist/index.js "Cash_Memo_Bulk.PDF"                  # -> Delivery_List_<name>.pdf
node dist/index.js memo.PDF out.pdf --sort=area          # route-wise (Category/Area), or --sort=name
node dist/index.js memo.PDF out.pdf --parts=2            # shorter address (max 2 parts)
npm test                                                 # address-cleaning tests
```

## Where to tweak
- `src/address.ts`  : relative (S/o, W/o, C/o...), pincode, Patna/Bihar removal. Rules are plain regexes.
- `src/extract.ts`  : column x-ranges of the memo layout (LEFT_MAX / MID_MAX).
- `src/pdf.ts`      : column widths, fonts, margins.

Payment = "Online" if Net Payable is 0, else "Cash". Missing fields are printed as a warning in the console.
Check the PDF once: if the source memo itself is cut off (e.g. "Near 70'"), the list keeps it as is.
