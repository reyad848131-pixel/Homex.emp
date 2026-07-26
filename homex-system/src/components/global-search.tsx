"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, User, Loader2, X } from "lucide-react";
import { useDebouncedValue } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

interface Results {
  quotations: Array<{ id: string; quoteNumber: string; status: string; total: number; customer: { name: string } }>;
  customers: Array<{ id: string; name: string; phone: string; governorate: string }>;
}

export function GlobalSearch() {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Results>({ quotations: [], customers: [] });
  const debounced = useDebouncedValue(q, 250);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounced.trim().length < 2) { setRes({ quotations: [], customers: [] }); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((r) => r.json())
      .then((d) => setRes({ quotations: d.quotations || [], customers: d.customers || [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debounced]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const hasResults = res.quotations.length > 0 || res.customers.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("globalSearchPlaceholder")}
        className="field pr-10 pl-8"
      />
      {q && (
        <button onClick={() => { setQ(""); setOpen(false); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      )}

      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("searching")}
            </div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">{t("noResults")}</div>
          )}
          {res.quotations.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-gray-400 uppercase">{t("quotations")}</p>
              {res.quotations.map((item) => (
                <button key={item.id} onClick={() => go(`/quotations/${item.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-right">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 dark:text-white font-mono-en">{item.quoteNumber}</span>
                    <span className="block text-xs text-gray-400 truncate">{item.customer?.name}</span>
                  </span>
                  <span className="text-xs font-mono-en font-bold text-gray-500 shrink-0">{item.total.toFixed(3)}</span>
                </button>
              ))}
            </div>
          )}
          {res.customers.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-gray-400 uppercase">{t("customers")}</p>
              {res.customers.map((c) => (
                <button key={c.id} onClick={() => go(`/customers/${c.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-right">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</span>
                    <span className="block text-xs text-gray-400 font-mono-en">{c.phone} · {c.governorate}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
