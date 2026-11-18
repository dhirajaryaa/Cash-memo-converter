"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildPdf } from "@/src/core/pdf";
import { buildDeliveryList, csvFor, subtitleFor, UNASSIGNED_AREA } from "@/src/core/rows";
import type { ConvertStats, DeliveryRow, RawMemo, SortMode } from "@/src/core/types";
import { extractMemosFromPdf } from "@/lib/browser-extract";
import {
  AlertIcon,
  ArrowRightIcon,
  CashIcon,
  CheckIcon,
  ChipOffIcon,
  AzIcon,
  CloseIcon,
  DownloadIcon,
  FileIcon,
  LayersIcon,
  ListIcon,
  LockIcon,
  OnlineIcon,
  PinIcon,
  PrinterIcon,
  RefreshIcon,
  RouteIcon,
  SearchIcon,
  ShieldIcon,
  UploadIcon,
} from "./icons";

type Phase = "idle" | "working" | "ready" | "error";
type StageKey = "read" | "open" | "pages" | "match" | "render" | "done";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "read", label: "Reading the file" },
  { key: "open", label: "Opening the memo" },
  { key: "pages", label: "Reading customer pages" },
  { key: "match", label: "Matching names, addresses and payments" },
  { key: "render", label: "Building the A4 delivery list" },
  { key: "done", label: "Delivery list ready" },
];

const SORTS: { value: SortMode; label: string; icon: typeof ListIcon }[] = [
  { value: "memo", label: "Memo order", icon: ListIcon },
  { value: "area", label: "By area", icon: RouteIcon },
  { value: "name", label: "By name", icon: AzIcon },
];

const PARTS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "Short", hint: "1 part" },
  { value: 2, label: "Standard", hint: "2 parts" },
  { value: 3, label: "Full", hint: "3 parts" },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/password|encrypt/i.test(message)) return "This PDF is password-protected. Unlock it and try again.";
  if (/invalid|structure|corrupt/i.test(message)) return "That file could not be read as a PDF. Export the cash memo again and retry.";
  return message || "Something went wrong while reading the memo.";
}

export default function ConverterApp() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<StageKey>("read");
  const [pageInfo, setPageInfo] = useState<{ page: number; pages: number } | null>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [memos, setMemos] = useState<RawMemo[]>([]);
  const [sort, setSort] = useState<SortMode>("memo");
  const [parts, setParts] = useState(3);
  const [shop, setShop] = useState("DIVYASHRI KD INDANE");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const builtKeyRef = useRef("");

  const result = useMemo(
    () => (memos.length ? buildDeliveryList(memos, { sort, parts }) : null),
    [memos, sort, parts],
  );
  const rows = result?.rows ?? [];
  const stats: ConvertStats | null = result?.stats ?? null;
  const warnings = result?.warnings ?? [];

  const buildKey = `${memos.length}|${sort}|${parts}|${shop.trim()}`;

  const titleFor = useCallback(
    (shopName: string) => (shopName.trim() ? `${shopName.trim()} - Delivery List` : "Delivery List"),
    [],
  );

  const renderPdf = useCallback(
    async (list: DeliveryRow[], listStats: ConvertStats, shopName: string, group: boolean) => {
      const bytes = await buildPdf(list, {
        title: titleFor(shopName),
        subtitle: subtitleFor(listStats),
        groupByArea: group,
      });
      return new Blob([bytes.slice()], { type: "application/pdf" });
    },
    [titleFor],
  );

  const handleFile = useCallback(
    async (picked: File) => {
      setError("");
      if (!/\.pdf$/i.test(picked.name) && picked.type !== "application/pdf") {
        setError("Choose the Cash Memo Bulk PDF. Other file types are not read.");
        setPhase("error");
        return;
      }
      if (picked.size > 50 * 1024 * 1024) {
        setError("That PDF is over 50 MB. Split the bulk memo into smaller files and try again.");
        setPhase("error");
        return;
      }

      setFile({ name: picked.name, size: picked.size });
      setMemos([]);
      setPdfBlob(null);
      setQuery("");
      setProgress(3);
      setStage("read");
      setPageInfo(null);
      setPhase("working");
      builtKeyRef.current = "";
      await wait(70);

      try {
        setProgress(8);
        setStage("open");
        const buffer = await picked.arrayBuffer();
        setProgress(12);
        await wait(40);

        const extracted = await extractMemosFromPdf(buffer, (page, pages) => {
          setStage("pages");
          setPageInfo({ page, pages });
          setProgress(14 + Math.round((page / pages) * 56));
        });

        setStage("match");
        setProgress(74);
        await wait(90);
        const list = buildDeliveryList(extracted, { sort, parts });
        if (!list.rows.length) {
          throw new Error("No customer memos were found in this PDF. Check that it is an Indane Cash Memo Bulk export.");
        }

        setStage("render");
        setProgress(84);
        await wait(70);
        const blob = await renderPdf(list.rows, list.stats, shop, sort === "area");

        setProgress(100);
        setStage("done");
        setMemos(extracted);
        setPdfBlob(blob);
        builtKeyRef.current = `${extracted.length}|${sort}|${parts}|${shop.trim()}`;
        await wait(320);
        setPhase("ready");
      } catch (err) {
        setError(errorMessage(err));
        setPhase("error");
      }
    },
    [parts, renderPdf, shop, sort],
  );

  // Options changed after the first render: rebuild the PDF quietly.
  useEffect(() => {
    if (!memos.length || phase !== "ready" || builtKeyRef.current === buildKey) return;
    let cancelled = false;
    setBuilding(true);
    const timer = setTimeout(async () => {
      try {
        const list = buildDeliveryList(memos, { sort, parts });
        const blob = await renderPdf(list.rows, list.stats, shop, sort === "area");
        if (cancelled) return;
        setPdfBlob(blob);
        setError("");
        builtKeyRef.current = buildKey;
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildKey, memos, parts, phase, renderPdf, shop, sort]);

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setMemos([]);
    setPdfBlob(null);
    setProgress(0);
    setStage("read");
    setPageInfo(null);
    setError("");
    setQuery("");
    setBuilding(false);
    builtKeyRef.current = "";
    if (inputRef.current) inputRef.current.value = "";
  };

  const slug = (file?.name ?? "Cash_Memo").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_");
  const variant = sort === "area" ? "by-area" : sort === "name" ? "by-name" : "memo-order";

  const download = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}_delivery-list_${variant}_${parts}p.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadCsv = () => {
    if (!rows.length) return;
    const blob = new Blob(["\ufeff" + csvFor(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}_delivery-list_${variant}_${parts}p.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .map((row, i) => ({ ...row, sr: i + 1 }))
      .filter(
        (row) =>
          !q ||
          [row.name, row.address, row.mobile, row.area, row.bookingDate].some((v) =>
            v.toLowerCase().includes(q),
          ),
      );
  }, [query, rows]);

  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="site">
      <a className="skip-link" href="#converter">
        Skip to the converter
      </a>

      <header className="topbar">
        <div className="shell topbar-inner">
          <a className="brand" href="#" aria-label="Delivery List home">
            <span className="brand-mark">
              <LayersIcon size={18} />
            </span>
            <span className="brand-text">
              Delivery List
              <small>Cash memo converter</small>
            </span>
          </a>
          <div className="topbar-right">
            <span className="status-pill">
              <span className="status-dot" aria-hidden="true" />
              No uploads
            </span>
            <a className="topbar-link" href="#privacy">
              Privacy
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="hero shell" id="converter" aria-labelledby="hero-title">
          <div className="hero-copy" data-enter>
            <p className="eyebrow">
              <span aria-hidden="true" />
              Indane cash memo → delivery list
            </p>
            <h1 id="hero-title">
              Cash memo in.
              <span>Delivery list out.</span>
            </h1>
            <p className="lede">
              Drop the distributor&apos;s Cash Memo Bulk PDF. Your browser reads every memo, cleans the
              addresses and builds a route-ready A4 list. The file never leaves this device.
            </p>
            <ul className="proof">
              <li>
                <ShieldIcon size={18} /> No upload
              </li>
              <li>
                <ChipOffIcon size={18} /> No AI
              </li>
              <li>
                <PrinterIcon size={18} /> A4 PDF + CSV
              </li>
            </ul>
            <p className="hero-note">
              <LockIcon size={16} />
              pdf.js reads the memo. pdf-lib writes the list. Both run locally.
            </p>
          </div>

          <div className="converter-card" data-enter>
            <div className="card-head">
              <div className="card-heading">
                <span className="step">01</span>
                <h2>Upload the bulk memo</h2>
              </div>
              <span className="file-pill">PDF</span>
            </div>

            {(phase === "idle" || phase === "error") && (
              <>
                <label
                  className={`dropzone${dragging ? " is-dragging" : ""}`}
                  htmlFor="memo-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) void handleFile(dropped);
                  }}
                >
                  <input
                    ref={inputRef}
                    id="memo-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      e.target.value = "";
                      if (picked) void handleFile(picked);
                    }}
                  />
                  <span className="drop-icon">
                    <UploadIcon size={25} />
                  </span>
                  <p className="drop-title">Drop the cash memo PDF</p>
                  <p className="drop-sub">
                    or <span className="linklike">choose a file</span> · one bulk PDF · up to 50 MB
                  </p>
                  <div className="drop-meta" aria-hidden="true">
                    <span>Order type</span>
                    <span>Customer</span>
                    <span>Address</span>
                    <span>Payment</span>
                  </div>
                </label>
                {error && (
                  <p className="error-box" role="alert">
                    <AlertIcon size={18} />
                    <span>{error}</span>
                  </p>
                )}
              </>
            )}

            {phase === "working" && file && (
              <div className="progress-panel" aria-live="polite">
                <div className="file-row">
                  <span className="file-badge">
                    <FileIcon size={19} />
                  </span>
                  <span className="file-meta">
                    <strong>{file.name}</strong>
                    <small>
                      {formatBytes(file.size)} · reading on this device
                    </small>
                  </span>
                  <button type="button" className="icon-button" onClick={reset} aria-label="Cancel conversion">
                    <CloseIcon size={17} />
                  </button>
                </div>
                <div className="progress-head">
                  <span>{STAGES[Math.max(0, stageIndex)]?.label}</span>
                  <strong>{progress}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Conversion progress"
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                {stage === "pages" && pageInfo && (
                  <p className="page-count">
                    Page {pageInfo.page} of {pageInfo.pages}
                  </p>
                )}
                <ol className="stages">
                  {STAGES.slice(0, 5).map((item, i) => {
                    const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "todo";
                    return (
                      <li key={item.key} className={state}>
                        <span className="stage-dot">
                          {state === "done" ? <CheckIcon size={12} /> : <span />}
                        </span>
                        {item.label}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {phase === "ready" && file && stats && (
              <div className="ready-panel">
                <div className="ready-top">
                  <span className="ready-check">
                    <CheckIcon size={22} />
                  </span>
                  <div>
                    <h3>
                      {stats.total} {stats.total === 1 ? "entry" : "entries"} ready
                    </h3>
                    <p>
                      {stats.cash} cash · {stats.online} online · {stats.areas.length}{" "}
                      {stats.areas.length === 1 ? "area" : "areas"}
                    </p>
                  </div>
                </div>
                <p className="ready-file" title={file.name}>
                  <FileIcon size={13} /> {file.name}
                </p>
                <div className="ready-actions">
                  <button type="button" className="btn btn-primary" onClick={download} disabled={building || !pdfBlob}>
                    <DownloadIcon size={18} />
                    {building ? "Updating PDF…" : "Download delivery list"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={downloadCsv}>
                    CSV
                  </button>
                </div>
                <div className="ready-foot">
                  <button type="button" className="text-button" onClick={reset}>
                    <RefreshIcon size={15} /> Convert another
                  </button>
                  <a className="text-button" href="#preview">
                    Review {stats.total} entries <ArrowRightIcon size={15} />
                  </a>
                </div>
                {warnings.length > 0 && (
                  <p className="soft-warning">
                    <AlertIcon size={16} />
                    {warnings.length} field issue{warnings.length === 1 ? "" : "s"} — review the amber rows
                    below.
                  </p>
                )}
              </div>
            )}

            <div className="options">
              <fieldset className="field">
                <legend>Sort rows</legend>
                <div className="segmented">
                  {SORTS.map(({ value, label, icon: Icon }) => (
                    <label className="seg-option" key={value}>
                      <input
                        type="radio"
                        name="sort"
                        value={value}
                        checked={sort === value}
                        onChange={() => setSort(value)}
                      />
                      <span>
                        <Icon size={14} />
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="field">
                <legend>Address detail</legend>
                <div className="segmented">
                  {PARTS.map((p) => (
                    <label className="seg-option" key={p.value}>
                      <input
                        type="radio"
                        name="parts"
                        value={p.value}
                        checked={parts === p.value}
                        onChange={() => setParts(p.value)}
                      />
                      <span>
                        {p.label}
                        <small>{p.hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field field-wide">
                <span className="field-label">Distributor name on the list</span>
                <input
                  className="text-input"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  placeholder="Your distributor name"
                  maxLength={48}
                  spellCheck={false}
                />
              </label>
            </div>

            <p className="card-foot">
              <ShieldIcon size={15} />
              Processed on this device. Nothing is sent to a server.
            </p>
          </div>
        </section>

        {phase === "ready" && stats && (
          <section className="results shell" id="preview" aria-labelledby="preview-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  <span aria-hidden="true" />
                  02 · Preview
                </p>
                <h2 id="preview-title">The list, before it prints.</h2>
                <p className="section-lede">
                  Check every address and payment. Change the sort or address detail above and the PDF
                  updates in place.
                </p>
              </div>
              <div className="section-actions">
                <button type="button" className="btn btn-ghost" onClick={downloadCsv}>
                  <FileIcon size={17} /> CSV
                </button>
                <button type="button" className="btn btn-primary" onClick={download} disabled={building || !pdfBlob}>
                  <DownloadIcon size={17} />
                  {building ? "Updating…" : "Download PDF"}
                </button>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stat-label">
                  <LayersIcon size={15} /> Entries
                </span>
                <strong>{stats.total}</strong>
                <small>{stats.areas.length} areas in this run</small>
              </div>
              <div className="stat">
                <span className="stat-label">
                  <CashIcon size={15} /> Cash
                </span>
                <strong>{stats.cash}</strong>
                <small>{stats.total ? Math.round((stats.cash / stats.total) * 100) : 0}% of the list</small>
              </div>
              <div className="stat stat-online">
                <span className="stat-label">
                  <OnlineIcon size={15} /> Online
                </span>
                <strong>{stats.online}</strong>
                <small>{stats.total ? Math.round((stats.online / stats.total) * 100) : 0}% already paid</small>
              </div>
              <div className="stat">
                <span className="stat-label">
                  <PinIcon size={15} /> Routes
                </span>
                <strong>{stats.areas.length}</strong>
                <small>
                  {stats.areas[0]?.area ?? "—"}
                  {stats.areas.length > 1 ? ` +${stats.areas.length - 1}` : ""}
                </small>
              </div>
            </div>

            <div className="table-card">
              <div className="table-tools">
                <label className="search">
                  <SearchIcon size={17} />
                  <span className="sr-only">Search the delivery list</span>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, mobile, area…"
                    type="search"
                  />
                </label>
                <span className="table-count">
                  Showing {filtered.length} of {rows.length}
                </span>
              </div>

              {warnings.length > 0 && phase === "ready" && (
                <details className="warnings" open={warnings.length <= 3}>
                  <summary>
                    <AlertIcon size={16} />
                    {warnings.length} field issue{warnings.length === 1 ? "" : "s"} to check before delivery
                  </summary>
                  <ul>
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">Delivery list entries extracted from the cash memo</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sr.</th>
                      <th scope="col">Name</th>
                      <th scope="col">Address</th>
                      <th scope="col">Mobile</th>
                      <th scope="col">Area</th>
                      <th scope="col">Payment</th>
                      <th scope="col">Booking date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={`${row.sr}-${row.mobile}-${row.invoiceNo}`}>
                        <td data-label="Sr." className="cell-sr">
                          {row.sr}
                        </td>
                        <td data-label="Name" className="cell-name">
                          <strong>{row.name}</strong>
                        </td>
                        <td data-label="Address" className="cell-address">
                          {row.address || <span className="muted">No address in memo</span>}
                        </td>
                        <td data-label="Mobile" className="cell-mobile">
                          <a href={`tel:${row.mobile}`}>{row.mobile}</a>
                        </td>
                        <td data-label="Area">
                          <span className={`area-chip${row.area === UNASSIGNED_AREA ? " is-warn" : ""}`}>
                            {row.area}
                          </span>
                        </td>
                        <td data-label="Payment">
                          <span className={`pay pay-${row.payment.toLowerCase()}`}>{row.payment}</span>
                        </td>
                        <td data-label="Booking date" className="cell-date">
                          {row.bookingDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="no-results">
                    No entries match “{query}”. <button type="button" onClick={() => setQuery("")}>Clear search</button>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="privacy" id="privacy" aria-labelledby="privacy-title">
          <div className="shell">
            <div className="privacy-head">
              <p className="eyebrow eyebrow-light">
                <span aria-hidden="true" />
                Privacy by construction
              </p>
              <h2 id="privacy-title">Customer data stays on this machine.</h2>
              <p>
                A delivery list carries names, phone numbers and home addresses. This tool reads the memo
                in the tab and writes the PDF in the tab. Nothing is uploaded, logged or learned.
              </p>
            </div>
            <div className="privacy-grid">
              <article>
                <span className="privacy-icon">
                  <LockIcon size={21} />
                </span>
                <h3>No upload</h3>
                <p>The PDF never leaves the browser. There is no server endpoint to receive it.</p>
              </article>
              <article>
                <span className="privacy-icon">
                  <ChipOffIcon size={21} />
                </span>
                <h3>No AI</h3>
                <p>Addresses are cleaned by fixed rules, not a model. The same input gives the same list.</p>
              </article>
              <article>
                <span className="privacy-icon">
                  <RefreshIcon size={21} />
                </span>
                <h3>No copy kept</h3>
                <p>Entries live in memory for this tab. Refresh or close it and they are gone.</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <span className="footer-brand">
            <LayersIcon size={16} /> Delivery List
          </span>
          <span>pdf.js + pdf-lib · offline by design</span>
          <span>Built for the distributor&apos;s desk</span>
        </div>
      </footer>
    </div>
  );
}
