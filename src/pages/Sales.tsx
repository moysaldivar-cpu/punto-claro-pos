import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

type SaleStatus = "active" | "cancelled" | "partially_returned" | "fully_returned";

type Sale = {
  id: string;
  folio: string;
  created_at: string;
  user_name: string | null;
  payment_method: string | null;
  total: number;
  returned_total: number;
  status: SaleStatus;
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

    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return { start, end };
  }

  function getNetTotal(sale: Sale) {
    if (sale.status === "cancelled" || sale.status === "fully_returned") {
      return 0;
    }

    return Math.max(Number(sale.total || 0) - Number(sale.returned_total || 0), 0);
  }

  function getNetRatio(sale: Sale) {
    const total = Number(sale.total || 0);
    const netTotal = getNetTotal(sale);

    if (sale.status === "cancelled" || sale.status === "fully_returned") {
      return 0;
    }

    if (total <= 0) {
      return 0;
    }

    return netTotal / total;
  }

  function getStatusLabel(status: SaleStatus) {
    if (status === "cancelled") return "Cancelado";
    if (status === "partially_returned") return "Devolución parcial";
    if (status === "fully_returned") return "Devuelto completo";
    return "Activo";
  }

  function getStatusClass(status: SaleStatus) {
    if (status === "cancelled") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (status === "partially_returned") {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === "fully_returned") {
      return "bg-purple-100 text-purple-700 border-purple-200";
    }

    return "bg-green-100 text-green-700 border-green-200";
  }

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  async function load() {
    setLoading(true);

    const { start, end } = getRange();

    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, folio, created_at, user_name, payment_method, total, returned_total, status, payment_cash, payment_card, payment_usd"
      )
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

    const list = ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      folio: String(row.folio || ""),
      created_at: String(row.created_at),
      user_name: row.user_name ? String(row.user_name) : null,
      payment_method: row.payment_method ? String(row.payment_method) : null,
      total: Number(row.total || 0),
      returned_total: Number(row.returned_total || 0),
      status: (row.status || "active") as SaleStatus,
      payment_cash: Number(row.payment_cash || 0),
      payment_card: Number(row.payment_card || 0),
      payment_usd: Number(row.payment_usd || 0),
    })) as Sale[];

    setRows(list);

    setTotals({
      total: list.reduce((acc, sale) => acc + getNetTotal(sale), 0),
      cash: list.reduce(
        (acc, sale) => acc + Number(sale.payment_cash || 0) * getNetRatio(sale),
        0
      ),
      card: list.reduce(
        (acc, sale) => acc + Number(sale.payment_card || 0) * getNetRatio(sale),
        0
      ),
      usd: list.reduce(
        (acc, sale) => acc + Number(sale.payment_usd || 0) * getNetRatio(sale),
        0
      ),
    });

    setLoading(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Ventas</h1>

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

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card title="Total Neto" value={totals.total} />
        <Card title="Efectivo Neto" value={totals.cash} />
        <Card title="Tarjeta Neta" value={totals.card} />
        <Card title="USD Neto" value={totals.usd} isUsd />
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded mb-4">
        <p className="text-sm">
          Esta pantalla muestra ventas netas. Los tickets cancelados cuentan como
          $0.00 y las devoluciones parciales descuentan únicamente el importe
          devuelto.
        </p>
      </div>

      <div className="bg-white rounded border">
        {loading ? (
          <p className="p-4 text-gray-500">Cargando ventas...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-gray-500">No hay ventas para este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2 text-left">Folio</th>
                <th className="p-2 text-left">Estado</th>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Usuario</th>
                <th className="p-2 text-left">Método</th>
                <th className="p-2 text-right">Original</th>
                <th className="p-2 text-right">Devuelto</th>
                <th className="p-2 text-right">Neto</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((v) => {
                const netTotal = getNetTotal(v);
                const isAdjusted =
                  v.status === "cancelled" ||
                  v.status === "partially_returned" ||
                  v.status === "fully_returned";

                return (
                  <tr
                    key={v.id}
                    className={`border-b hover:bg-gray-50 cursor-pointer ${
                      v.status === "cancelled" || v.status === "fully_returned"
                        ? "bg-gray-50 text-gray-500"
                        : ""
                    }`}
                    onClick={() => navigate(`/sales/${v.id}`)}
                  >
                    <td className="p-2 font-medium">{v.folio}</td>

                    <td className="p-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(
                          v.status
                        )}`}
                      >
                        {getStatusLabel(v.status)}
                      </span>
                    </td>

                    <td className="p-2">
                      {new Date(v.created_at).toLocaleString()}
                    </td>

                    <td className="p-2">{v.user_name || "Sin nombre"}</td>

                    <td className="p-2 capitalize">
                      {v.payment_method || "Sin método"}
                    </td>

                    <td
                      className={`p-2 text-right ${
                        isAdjusted ? "line-through text-gray-400" : ""
                      }`}
                    >
                      {money(v.total)}
                    </td>

                    <td className="p-2 text-right text-red-600">
                      {Number(v.returned_total || 0) > 0
                        ? money(v.returned_total)
                        : "-"}
                    </td>

                    <td className="p-2 text-right font-semibold">
                      {money(netTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  isUsd = false,
}: {
  title: string;
  value: number;
  isUsd?: boolean;
}) {
  return (
    <div className="bg-white border rounded p-4">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-xl font-bold">
        {isUsd ? usdValue(value) : `$${Number(value || 0).toFixed(2)}`}
      </p>
    </div>
  );
}

function usdValue(value: number) {
  return `$${Number(value || 0).toFixed(4)}`;
}