import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

type Sale = {
  id: string;
  folio: string;
  created_at: string;
  user_name: string;
  payment_method: string;
  total: number;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
};

type Period = "today" | "yesterday" | "month";

export default function Sales() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Sale[]>([]);
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(false);

  const [totals, setTotals] = useState({
    total: 0,
    cash: 0,
    card: 0,
    usd: 0,
  });

  useEffect(() => {
    load();
  }, [period]);

  function getRange() {
    const now = new Date();

    if (period === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    }

    if (period === "yesterday") {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);

      return { start, end };
    }

    // month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return { start, end };
  }

  async function load() {
    setLoading(true);

    const { start, end } = getRange();

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setTotals({ total: 0, cash: 0, card: 0, usd: 0 });
      setLoading(false);
      return;
    }

    const list = (data || []) as Sale[];

    setRows(list);

    setTotals({
      total: list.reduce((a, b) => a + (b.total || 0), 0),
      cash: list.reduce((a, b) => a + (b.payment_cash || 0), 0),
      card: list.reduce((a, b) => a + (b.payment_card || 0), 0),
      usd: list.reduce((a, b) => a + (b.payment_usd || 0), 0),
    });

    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Ventas</h1>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPeriod("today")}
          className={`px-3 py-1 border rounded ${
            period === "today" ? "bg-gray-900 text-white" : ""
          }`}
        >
          Hoy
        </button>

        <button
          onClick={() => setPeriod("yesterday")}
          className={`px-3 py-1 border rounded ${
            period === "yesterday" ? "bg-gray-900 text-white" : ""
          }`}
        >
          Ayer
        </button>

        <button
          onClick={() => setPeriod("month")}
          className={`px-3 py-1 border rounded ${
            period === "month" ? "bg-gray-900 text-white" : ""
          }`}
        >
          Este mes
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card title="Total" value={totals.total} />
        <Card title="Efectivo" value={totals.cash} />
        <Card title="Tarjeta" value={totals.card} />
        <Card title="USD" value={totals.usd} />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded border">
        {loading ? (
          <p className="p-4 text-gray-500">Cargando ventas...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-gray-500">
            No hay ventas para este periodo.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 text-left">Folio</th>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Usuario</th>
                <th className="p-2 text-left">Método</th>
                <th className="p-2 text-right">Total</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((v) => (
                <tr
                  key={v.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/app/sale/${v.id}`)}
                >
                  <td className="p-2">{v.folio}</td>
                  <td className="p-2">
                    {new Date(v.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{v.user_name}</td>
                  <td className="p-2 capitalize">
                    {v.payment_method}
                  </td>
                  <td className="p-2 text-right">
                    ${v.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white border rounded p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold">${value.toFixed(2)}</p>
    </div>
  );
}
