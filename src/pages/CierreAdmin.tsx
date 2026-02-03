import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = {
  id: number;
  user_name: string;
  opened_at: string;
  closed_at: string;

  cash_total: number;
  card_total: number;
  dollars_total: number;

  real_cash: number;
  real_card: number;
  real_usd: number;

  total_sales: number;
};

export default function CierreAdmin() {
  const storeId = localStorage.getItem("store_id");

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from("cash_register_closures")
      .select("*")
      .eq("store_id", storeId)
      .not("closed_at", "is", null)
      .order("closed_at", { ascending: false })
      .limit(50);

    setRows((data as Row[]) || []);
  }

  function diff(a: number, b: number) {
    return (a || 0) - (b || 0);
  }

  // 🆕 EXPORT EXCEL SIMPLE
  function exportExcel() {
    const header = [
      "Cajero",
      "Efectivo declarado",
      "Efectivo real",
      "Tarjeta declarada",
      "Tarjeta real",
      "USD declarado",
      "USD real",
      "Diferencia total",
      "Cierre"
    ];

    const lines = rows.map(r => [
      r.user_name,
      r.cash_total,
      r.real_cash,
      r.card_total,
      r.real_card,
      r.dollars_total,
      r.real_usd,
      diff(
        r.cash_total + r.card_total + r.dollars_total,
        r.real_cash + r.real_card + r.real_usd
      ),
      r.closed_at
    ]);

    const csv = [header, ...lines]
      .map(l => l.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cierres_punto_claro.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">
          Revisión de Cierres (Admin)
        </h2>

        {/* 🆕 BOTÓN EXPORTAR */}
        <button
          className="bg-green-600 text-white px-3 py-2 rounded"
          onClick={exportExcel}
        >
          Exportar Excel
        </button>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Cajero</th>
            <th className="p-2">Efectivo</th>
            <th className="p-2">Tarjeta</th>
            <th className="p-2">USD</th>
            <th className="p-2">Diferencias</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.user_name}</td>

              <td className="p-2 text-center">
                D: {r.cash_total} / R: {r.real_cash}
              </td>

              <td className="p-2 text-center">
                D: {r.card_total} / R: {r.real_card}
              </td>

              <td className="p-2 text-center">
                D: {r.dollars_total} / R: {r.real_usd}
              </td>

              <td className="p-2 text-center font-semibold">
                ${diff(
                  r.cash_total + r.card_total + r.dollars_total,
                  r.real_cash + r.real_card + r.real_usd
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
