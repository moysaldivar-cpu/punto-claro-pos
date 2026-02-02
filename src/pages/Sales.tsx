import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SaleRow = {
  id: string;
  folio: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  payment_method: string;
  payment_cash: number | null;
  payment_card: number | null;
  payment_usd: number | null;
  user_name: string | null;
  created_at: string;
};

type DateFilter = "today" | "yesterday" | "month" | "last30" | "all";

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function Sales() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Default: últimos 30 días (útil para pruebas y operación)
  const [filter, setFilter] = useState<DateFilter>("last30");
  const [selected, setSelected] = useState<SaleRow | null>(null);

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      setError(null);

      const storeId = localStorage.getItem("store_id");
      if (!storeId) {
        setError("No hay sucursal seleccionada.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          folio,
          total,
          subtotal,
          tax,
          payment_method,
          payment_cash,
          payment_card,
          payment_usd,
          user_name,
          created_at
        `)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading sales:", error);
        setError("No se pudieron cargar las ventas.");
        setSales([]);
      } else {
        setSales(data ?? []);
      }

      setLoading(false);
    };

    loadSales();
  }, []);

  const filteredSales = useMemo(() => {
    if (filter === "all") return sales;

    const now = new Date();

    // Ventanas por operación diaria: local day boundaries
    if (filter === "today") {
      const start = startOfLocalDay(now);
      const end = endOfLocalDay(now);
      return sales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      });
    }

    if (filter === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const start = startOfLocalDay(y);
      const end = endOfLocalDay(y);
      return sales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      });
    }

    if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      end.setHours(0, 0, 0, 0);

      return sales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d < end;
      });
    }

    // Últimos 30 días: rolling window (útil siempre)
    if (filter === "last30") {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return sales.filter((s) => {
        const d = new Date(s.created_at);
        return d >= start && d <= end;
      });
    }

    return sales;
  }, [sales, filter]);

  const totals = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let usd = 0;

    filteredSales.forEach((s) => {
      if (s.total == null) return;

      total += s.total;
      cash += s.payment_cash ?? 0;
      card += s.payment_card ?? 0;
      usd += s.payment_usd ?? 0;
    });

    return { total, cash, card, usd };
  }, [filteredSales]);

  const filterLabel =
    filter === "today"
      ? "Hoy"
      : filter === "yesterday"
      ? "Ayer"
      : filter === "month"
      ? "Este mes"
      : filter === "last30"
      ? "Últimos 30 días"
      : "Todas";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-sm text-gray-500">
            Filtro: <span className="font-medium">{filterLabel}</span> ·{" "}
            {filteredSales.length} ventas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("today")}
          className={`px-3 py-1 rounded border text-sm ${
            filter === "today" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => setFilter("yesterday")}
          className={`px-3 py-1 rounded border text-sm ${
            filter === "yesterday" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          Ayer
        </button>
        <button
          onClick={() => setFilter("month")}
          className={`px-3 py-1 rounded border text-sm ${
            filter === "month" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          Este mes
        </button>

        <button
          onClick={() => setFilter("last30")}
          className={`px-3 py-1 rounded border text-sm ${
            filter === "last30" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          Últimos 30 días
        </button>

        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded border text-sm ${
            filter === "all" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          Todas
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border rounded p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold">${totals.total.toFixed(2)}</p>
        </div>

        <div className="bg-white border rounded p-4">
          <p className="text-xs text-gray-500">Efectivo</p>
          <p>${totals.cash.toFixed(2)}</p>
        </div>

        <div className="bg-white border rounded p-4">
          <p className="text-xs text-gray-500">Tarjeta</p>
          <p>${totals.card.toFixed(2)}</p>
        </div>

        <div className="bg-white border rounded p-4">
          <p className="text-xs text-gray-500">USD</p>
          <p>${totals.usd.toFixed(2)}</p>
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Cargando ventas…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Folio</th>
                <th className="border px-3 py-2 text-left">Fecha</th>
                <th className="border px-3 py-2 text-left">Usuario</th>
                <th className="border px-3 py-2 text-left">Método</th>
                <th className="border px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelected(s)}
                >
                  <td className="border px-3 py-2">{s.folio ?? "—"}</td>
                  <td className="border px-3 py-2">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td className="border px-3 py-2">{s.user_name ?? "—"}</td>
                  <td className="border px-3 py-2 capitalize">
                    {s.payment_method}
                  </td>
                  <td className="border px-3 py-2 text-right font-medium">
                    {s.total !== null ? `$${s.total.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border px-3 py-4 text-center text-gray-500"
                  >
                    No hay ventas para este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detalle */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded p-6 w-full max-w-md space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold">
                Detalle de venta {selected.folio ?? "—"}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-gray-500 hover:underline"
              >
                Cerrar
              </button>
            </div>

            <p className="text-sm text-gray-500">
              {new Date(selected.created_at).toLocaleString()}
            </p>

            <div className="space-y-1">
              <p>Subtotal: {selected.subtotal !== null ? `$${selected.subtotal.toFixed(2)}` : "—"}</p>
              <p>Impuesto: {selected.tax !== null ? `$${selected.tax.toFixed(2)}` : "—"}</p>
              <p className="font-bold">
                Total: {selected.total !== null ? `$${selected.total.toFixed(2)}` : "—"}
              </p>
            </div>

            <hr />

            <div className="space-y-1">
              <p>Efectivo: ${((selected.payment_cash ?? 0) as number).toFixed(2)}</p>
              <p>Tarjeta: ${((selected.payment_card ?? 0) as number).toFixed(2)}</p>
              <p>USD: ${((selected.payment_usd ?? 0) as number).toFixed(2)}</p>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-3 w-full border rounded py-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
