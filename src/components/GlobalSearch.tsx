import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, FileText, Users, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { useStore } from "@/lib/store";

// The header search box used to be pure decoration — no value, no onChange,
// typing into it did nothing. This wires it to a real cross-module lookup
// (invoices/customers/products) with a small results dropdown, matching
// what a search box at the top of every screen is expected to do.
export function GlobalSearch() {
  const { invoices, customers, products } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { invoices: [], customers: [], products: [] };
    return {
      invoices: invoices.filter((i) => i.number.toLowerCase().includes(q)).slice(0, 5),
      customers: customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)).slice(0, 5),
      products: products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)).slice(0, 5),
    };
  }, [query, invoices, customers, products]);

  const hasResults = results.invoices.length + results.customers.length + results.products.length > 0;

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    setQuery("");
    navigate(params ? ({ to, params } as never) : ({ to } as never));
  };

  return (
    <Popover open={open && query.trim().length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative ml-1 hidden max-w-sm flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices, customers, products…"
            className="h-9 pl-9"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => query.trim() && setOpen(true)}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[360px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        {!hasResults ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">No matches for "{query}"</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {results.invoices.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invoices</div>
                {results.invoices.map((i) => (
                  <button key={i.id} type="button" onClick={() => go("/invoices/$id", { id: i.id })} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{i.number}</span>
                  </button>
                ))}
              </div>
            )}
            {results.customers.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clients / Suppliers</div>
                {results.customers.map((c) => (
                  <button key={c.id} type="button" onClick={() => go("/customers")} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    {c.phone && <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {results.products.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Products / Services</div>
                {results.products.map((p) => (
                  <button key={p.id} type="button" onClick={() => go("/products")} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    {p.sku && <span className="shrink-0 text-xs text-muted-foreground">{p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
