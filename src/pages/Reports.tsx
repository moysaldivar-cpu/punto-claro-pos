import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type Totals = {
  total_sales: number;
  count_sales: number;
  cash_total: number;
  card_total: number;
  usd_total: number;
};

export default function Reports() {
  const { role, loadingRole } = useAuth();
  const isAdmin = role === "admin";

  const today = new Date().toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);

  const [loading, setLoading] = useState<boolean>(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function loadReport() {
    setLoading(true);
    setError(null);

    const from = `${fromDate}T00:00:00`;
    const to = `${toDate}T23:59:59`;

    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, total, payment_cash, payment_card, payment_usd, created_at"
      )
      .gte("created_at", from)
      .lte("created_at", to);

    if (error || !data) {
      setError("No se pudo generar el reporte");
      setLoading(false);
      return;
    }

    const computed: Totals = {
      total_sales: data.reduce((s, r) => s + r.total, 0),
      count_sales: data.length,
      cash_total: data.reduce((s, r) => s + (r.payment_cash || 0), 0),
      card_total: data.reduce((s, r) => s + (r.payment_card || 0), 0),
      usd_total: data.reduce((s, r) => s + (r.payment_usd || 0), 0),
    };

    setTotals(computed);
    setLoading(false);
  }

  if (loadingRole) {
    return <div className="p-6">Cargando…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-red-600">
        No tienes permiso para ver reportes.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Reportes</h1>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm">Desde</label>
          <input
            type="date"
            className="border p-1"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm">Hasta</label>
          <input
            type="date"
            className="border p-1"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <button
          onClick={loadReport}
          className="self-end px-4 py-1 bg-black text-white rounded"
          disabled={loading}
        >
          {loading ? "Generando…" : "Generar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-600">{error}</div>
      )}

      {totals && (
        <div className="grid grid-cols-5 gap-4">
          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Ventas</div>
            <div className="text-xl font-bold">
              {totals.count_sales}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-xl font-bold">
              ${totals.total_sales}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Efectivo</div>
            <div className="text-xl font-bold">
              ${totals.cash_total}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">Tarjeta</div>
            <div className="text-xl font-bold">
              ${totals.card_total}
            </div>
          </div>

          <div className="p-4 border rounded">
            <div className="text-sm text-gray-500">USD</div>
            <div className="text-xl font-bold">
              ${totals.usd_total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
