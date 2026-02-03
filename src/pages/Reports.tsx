import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import { downloadExcel } from "@/lib/export";

export default function Reports() {
  const { role } = useAuth();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [totals, setTotals] = useState({
    total: 0,
    cash: 0,
    card: 0,
    usd: 0,
  });

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data || []);

    if (can(role, "view_totals")) {
      const total = data?.reduce((a, b) => a + (b.total || 0), 0) || 0;
      const cash = data?.reduce((a, b) => a + (b.payment_cash || 0), 0) || 0;
      const card = data?.reduce((a, b) => a + (b.payment_card || 0), 0) || 0;
      const usd = data?.reduce((a, b) => a + (b.payment_usd || 0), 0) || 0;

      setTotals({ total, cash, card, usd });
    }

    setLoading(false);
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFrom(today + " 00:00:00");
    setTo(today + " 23:59:59");
  }, []);

  // 🔐 Exportar SOLO admin
  function handleExport() {
    if (!can(role, "export")) return;

    const fileName = `reporte_ventas_${from.slice(0,10)}_${to.slice(0,10)}.xlsx`;

    const formatted = rows.map(r => ({
      Folio: r.folio,
      Fecha: new Date(r.created_at).toLocaleString(),
      Usuario: r.user_name,
      Metodo: r.payment_method,
      Total: r.total,
      Efectivo: r.payment_cash,
      Tarjeta: r.payment_card,
      USD: r.payment_usd,
    }));

    downloadExcel(fileName, formatted);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

      <div className="bg-white p-4 rounded shadow mb-4 flex gap-4 items-end">
        <div>
          <label className="block text-sm">Inicio</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm">Fin</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <button
          onClick={load}
          className="bg-gray-900 text-white px-4 py-2 rounded"
        >
          Consultar
        </button>

        {can(role, "export") && (
          <button
            onClick={handleExport}
            className="border px-4 py-2 rounded hover:bg-gray-50"
          >
            Exportar Excel
          </button>
        )}
      </div>

      {can(role, "view_totals") && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card title="Total" value={totals.total} />
          <Card title="Efectivo" value={totals.cash} />
          <Card title="Tarjeta" value={totals.card} />
          <Card title="USD" value={totals.usd} />
        </div>
      )}

      {can(role, "view_sales_history") ? (
        <div className="bg-white rounded shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2">Folio</th>
                <th className="p-2">Fecha</th>
                <th className="p-2">Usuario</th>
                <th className="p-2">Método</th>
                <th className="p-2">Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.folio}</td>
                  <td className="p-2">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{r.user_name}</td>
                  <td className="p-2">{r.payment_method}</td>
                  <td className="p-2">${r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-500 mt-6">
          Tu rol no tiene permiso para ver el historial de ventas.
        </div>
      )}

      {loading && <p className="mt-2">Cargando...</p>}
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold">${value.toFixed(2)}</p>
    </div>
  );
}
