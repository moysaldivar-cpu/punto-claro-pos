import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClosureRow = {
  id: number;
  store_id: string | null;
  user_name: string | null;
  opened_at: string | null;
  closed_at: string | null;
  opening_amount: number | null;
  cash_total: number | null;
  card_total: number | null;
  dollars_total: number | null;
  total_sales: number | null;
  difference: number | null;
  notes: string | null;
  created_at: string | null;
};

export default function CashRegisterClosures() {
  const [rows, setRows] = useState<ClosureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClosures();
  }, []);

  async function loadClosures() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("cash_register_closures")
      .select(
        `
        id,
        store_id,
        user_name,
        opened_at,
        closed_at,
        opening_amount,
        cash_total,
        card_total,
        dollars_total,
        total_sales,
        difference,
        notes,
        created_at
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setRows((data as ClosureRow[]) ?? []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6">Cargando cortes de caja…</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Error al cargar cortes: {error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Cortes de Caja</h1>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">
          No hay cortes registrados.
        </div>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Apertura</th>
                <th className="px-3 py-2 text-left">Cierre</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-right">Efectivo</th>
                <th className="px-3 py-2 text-right">Tarjeta</th>
                <th className="px-3 py-2 text-right">USD</th>
                <th className="px-3 py-2 text-right">Total ventas</th>
                <th className="px-3 py-2 text-right">Diferencia</th>
                <th className="px-3 py-2 text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">
                    {r.opened_at
                      ? new Date(r.opened_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.closed_at
                      ? new Date(r.closed_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{r.user_name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {r.cash_total ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.card_total ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.dollars_total ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.total_sales ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.difference ?? 0}
                  </td>
                  <td className="px-3 py-2">{r.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
