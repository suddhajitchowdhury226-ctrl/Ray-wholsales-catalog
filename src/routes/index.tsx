import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/rhl-logo.png.asset.json";
import catalog from "@/data/products.json";

export const Route = createFileRoute("/")({
  component: CatalogPage,
  head: () => ({
    meta: [
      { title: "Ray's Healthy Living Wholesale Order Catalog 2026" },
      {
        name: "description",
        content:
          "Browse the 2026 Ray's Healthy Living wholesale catalog, enter quantities by RHL Product ID, then print, download or email your order.",
      },
      { property: "og:title", content: "Ray's Healthy Living Wholesale Order Catalog 2026" },
      {
        property: "og:description",
        content:
          "Digital, editable wholesale ordering catalog with live totals, printable order form and CSV export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Product = {
  category: string;
  type: string;
  item: string;
  rhlId: string;
  gsi: string;
  name: string;
  legacyName: string;
  desc: string;
  ingredients: string;
  size: string;
  price: number | null;
};

const PRODUCTS = catalog.products as Product[];
const CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.category))).sort();
const STORAGE_KEY = "rhl-order-v1";
const ORDER_EMAIL = "orders@rayonewholesale.com";

type Info = {
  store: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  po: string;
  date: string;
  notes: string;
};
const EMPTY_INFO: Info = {
  store: "",
  contact: "",
  email: "",
  phone: "",
  address: "",
  po: "",
  date: "",
  notes: "",
};

const money = (n: number) => `$${n.toFixed(2)}`;

function CatalogPage() {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [retail, setRetail] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<Info>(EMPTY_INFO);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [onlySelected, setOnlySelected] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setQty(d.qty ?? {});
        setLineNotes(d.lineNotes ?? {});
        setRetail(d.retail ?? {});
        setInfo({ ...EMPTY_INFO, ...(d.info ?? {}) });
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ qty, lineNotes, retail, info }));
  }, [qty, lineNotes, retail, info, loaded]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (onlySelected && !((qty[p.item] ?? 0) > 0)) return false;
      if (!q) return true;
      return [p.name, p.legacyName, p.rhlId, p.item, p.gsi, p.desc, p.size, p.ingredients]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [search, category, onlySelected, qty]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const orderLines = useMemo(
    () => PRODUCTS.filter((p) => (qty[p.item] ?? 0) > 0).map((p) => ({ p, q: qty[p.item] as number })),
    [qty],
  );
  const total = orderLines.reduce((s, l) => s + (l.p.price ?? 0) * l.q, 0);
  const units = orderLines.reduce((s, l) => s + l.q, 0);

  const setQ = (item: string, v: number) =>
    setQty((prev) => {
      const next = { ...prev };
      if (!v || v <= 0) delete next[item];
      else next[item] = Math.floor(v);
      return next;
    });

  const clearOrder = () => {
    if (!confirm("Clear all quantities and order details?")) return;
    setQty({});
    setLineNotes({});
    setInfo(EMPTY_INFO);
  };

  const csv = () => {
    const rows = [
      ["RHL Product ID", "Item #", "RHL UPC", "Product", "Size", "Unit Price", "SRP", "Qty", "Line Total", "Note"],
      ...orderLines.map((l) => [
        l.p.rhlId,
        l.p.item,
        l.p.gsi,
        l.p.name,
        l.p.size,
        (l.p.price ?? 0).toFixed(2),
        retail[l.p.item] ?? "",
        String(l.q),
        ((l.p.price ?? 0) * l.q).toFixed(2),
        lineNotes[l.p.item] ?? "",
      ]),
      [],
      ["Store", info.store, "PO #", info.po, "Order Total", total.toFixed(2)],
    ];
    const body = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `RHL-order-${info.store || "form"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const emailOrder = () => {
    const lines = orderLines
      .map(
        (l) =>
          `${l.p.rhlId} | ${l.p.name} ${l.p.size} | Qty ${l.q} | ${money((l.p.price ?? 0) * l.q)}${retail[l.p.item] ? ` | Retail ${retail[l.p.item]}` : ""
          }${lineNotes[l.p.item] ? ` | ${lineNotes[l.p.item]}` : ""
          }`,
      )
      .join("\n");
    const body = `Store: ${info.store}\nContact: ${info.contact}\nEmail: ${info.email}\nPhone: ${info.phone}\nShip to: ${info.address}\nPO #: ${info.po}\nDate: ${info.date}\n\nORDER (by RHL Product ID)\n${lines}\n\nOrder total: ${money(total)}\n\nNotes: ${info.notes}`;
    window.location.href = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(
      `Wholesale order - ${info.store || "New order"}`,
    )}&body=${encodeURIComponent(body)}`;
  };

  const field = (key: keyof Info, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={info[key] ?? ""}
        onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
        className="rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="no-print border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
          <img src={logo.url} alt="Ray's Healthy Living" className="h-14 w-auto" />
          <div className="mr-auto">
            <h1 className="font-display text-2xl font-bold text-leaf">
              2026 Wholesale Order Catalog
            </h1>
            <p className="text-sm text-muted-foreground">
              Order by RHL Product ID ·{" "}
              <a
                className="underline hover:text-primary"
                href="https://www.rayonewholesale.com/"
                target="_blank"
                rel="noreferrer"
              >
                rayonewholesale.com
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/rhl-2026-wholesale-catalog.pdf"
              download="RHL-2026-Wholesale-Catalog.pdf"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Download Catalog PDF
            </a>
            <button
              onClick={() => window.print()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Print / Save PDF
            </button>
            <button
              onClick={csv}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Download CSV
            </button>
            <button
              onClick={emailOrder}
              className="rounded-md border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"
            >
              Email order
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <section className="no-print rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-lg font-bold text-leaf">Order details</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {field("store", "Store name")}
            {field("contact", "Contact name")}
            {field("email", "Email", "email")}
            {field("phone", "Phone", "tel")}
            {field("address", "Ship to address")}
            {field("po", "Purchase order #")}
            {field("date", "Date", "date")}
            {field("notes", "Order notes")}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Everything you type is saved in this browser. Orders over $200 receive free UPS ground
            shipping (excludes empty bottles and orders shipped to HI).
          </p>
        </section>

        <section className="no-print mt-6 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, RHL ID, item # or ingredient…"
            className="min-w-64 flex-1 rounded-md border border-input bg-card px-3 py-2 outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-2"
          >
            <option>All</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="size-4 accent-[oklch(0.58_0.16_140)]"
            />
            Only my order
          </label>
          <button onClick={clearOrder} className="text-sm text-muted-foreground underline">
            Clear
          </button>
        </section>

        <div className="no-print mt-6 space-y-8">
          {grouped.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No products match your search.</p>
          )}
          {grouped.map(([cat, items]) => (
            <section key={cat}>
              <h2 className="sticky top-0 z-10 bg-background/95 py-2 font-display text-xl font-bold text-leaf">
                {cat}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({items.length} items)
                </span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-secondary-foreground">
                    <tr>
                      <th className="px-3 py-2">RHL ID</th>
                      <th className="px-3 py-2">RHL UPC</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">SRP</th>
                      <th className="px-3 py-2 w-24">Qty</th>
                      <th className="px-3 py-2 w-48">Line note</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const q = qty[p.item] ?? 0;
                      return (
                        <tr
                          key={p.item}
                          className={`border-t border-border align-top ${q > 0 ? "bg-secondary/50" : ""}`}
                        >
                          <td className="px-3 py-2 font-mono font-semibold">{p.rhlId}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                            {p.gsi || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.desc}</div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{p.size}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {p.price != null ? money(p.price) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={retail[p.item] ?? ""}
                              onChange={(e) =>
                                setRetail({ ...retail, [p.item]: e.target.value })
                              }
                              placeholder="—"
                              className="w-24 rounded-md border border-input bg-background px-2 py-1 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={q || ""}
                              onChange={(e) => setQ(p.item, Number(e.target.value))}
                              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={lineNotes[p.item] ?? ""}
                              onChange={(e) =>
                                setLineNotes({ ...lineNotes, [p.item]: e.target.value })
                              }
                              placeholder="write here…"
                              className="w-full rounded-md border border-input bg-background px-2 py-1"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                            {q > 0 ? money((p.price ?? 0) * q) : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        {/* Printable order form */}
        <div className="print-only">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src={logo.url} alt="Ray's Healthy Living" style={{ height: "60px" }} />
            <div>
              <h1 className="text-xl font-bold">2026 Wholesale Order Form</h1>
              <p className="text-xs">rayonewholesale.com · Order by RHL Product ID</p>
            </div>
          </div>
          <table className="mt-3 w-full text-xs">
            <tbody>
              <tr>
                <td>
                  <b>Store:</b> {info.store || "____________________"}
                </td>
                <td>
                  <b>Contact:</b> {info.contact || "____________________"}
                </td>
                <td>
                  <b>PO #:</b> {info.po || "__________"}
                </td>
                <td>
                  <b>Date:</b> {info.date || "__________"}
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <b>Email:</b> {info.email || "____________________"}
                </td>
                <td colSpan={2}>
                  <b>Phone:</b> {info.phone || "____________________"}
                </td>
              </tr>
              <tr>
                <td colSpan={4}>
                  <b>Ship to:</b> {info.address || "________________________________________"}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="mt-4 w-full border-collapse text-xs">
            <thead>
              <tr>
                {["RHL ID", "Item #", "RHL UPC", "Product", "Size", "Price", "SRP", "Qty", "Total", "Note"].map(
                  (h) => (
                    <th key={h} className="border border-neutral-400 px-1 py-1 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {(orderLines.length
                ? orderLines
                : filtered.slice(0, 400).map((p) => ({ p, q: 0 }))
              ).map(({ p, q }) => (
                <tr key={p.item}>
                  <td className="border border-neutral-400 px-1 py-1">{p.rhlId}</td>
                  <td className="border border-neutral-400 px-1 py-1">{p.item}</td>
                  <td className="border border-neutral-400 px-1 py-1">{p.gsi}</td>
                  <td className="border border-neutral-400 px-1 py-1">{p.name}</td>
                  <td className="border border-neutral-400 px-1 py-1">{p.size}</td>
                  <td className="border border-neutral-400 px-1 py-1">
                    {p.price != null ? money(p.price) : ""}
                  </td>
                  <td className="border border-neutral-400 px-1 py-1">{retail[p.item] ?? ""}</td>
                  <td className="border border-neutral-400 px-1 py-1">{q || ""}</td>
                  <td className="border border-neutral-400 px-1 py-1">
                    {q ? money((p.price ?? 0) * q) : ""}
                  </td>
                  <td className="border border-neutral-400 px-1 py-1">{lineNotes[p.item] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-right text-sm font-bold">
            Order total: {money(total)} ({units} units)
          </p>
          <p className="mt-2 text-[10px]">
            Orders over $200 receive free UPS ground shipping (excludes empty bottles and orders
            shipped to HI). Email completed form to {ORDER_EMAIL}.
          </p>
        </div>
      </main>

      <footer className="no-print fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="mr-auto text-sm">
            <b>{orderLines.length}</b> products · <b>{units}</b> units
          </div>
          <div className="font-display text-xl font-bold text-leaf">{money(total)}</div>
          <button
            onClick={() => setOnlySelected(true)}
            className="rounded-md border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
          >
            Review order
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Print order form
          </button>
        </div>
      </footer>
    </div>
  );
}
