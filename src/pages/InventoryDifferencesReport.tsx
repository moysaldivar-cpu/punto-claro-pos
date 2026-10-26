import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadExcel } from "@/lib/export";

type Store = {
  id: string;
  name: string;
};

type InventoryDifferenceReportRow = {
  store_id: string;
  store_name: string;
  cash_session_id: string;
  session_opened_at: string;
  product_id: string;
  product_name: string;
  system_stock: number;
  counted_stock: number;
  difference: number;
};

export default function InventoryDifferencesReport() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [rows, setRows] = useState<InventoryDifferenceReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  async function loadStores() {
    const { data, error } = await supabase
      .from("pos_stores")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setStores([]);
      return;
    }

    setStores((data ?? []) as Store[]);
  }

  async function fetchRows(): Promise<InventoryDifferenceReportRow[]> {
    const { data, error } = await supabase.rpc(
      "get_report_inventory_differences",
      {
        p_store_id: storeFilter === "all" ? null : storeFilter,
      }
    );

    if (error) {
      console.error(error);
      throw error;
    }

    return ((data ?? []) as any[]).map((row) => ({
      store_id: String(row.store_id || ""),
      store_name: String(row.store_name || "Sucursal").trim(),
      cash_session_id: String(row.cash_session_id || ""),
      session_opened_at: String(row.session_opened_at || ""),
      product_id: String(row.product_id || ""),
      product_name: String(row.product_name || "Producto").trim(),
      system_stock: Number(row.system_stock || 0),
      counted_stock: Number(row.counted_stock || 0),
      difference: Number(row.difference || 0),
    }));
  }

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const reportRows = await fetchRows();
      setRows(reportRows);
    } catch {
      setRows([]);
      setError("No se pudo cargar el reporte de diferencias de inventario.");
    } finally {
      setLoading(false);
    }
  }

  async function exportReport() {
    setError(null);

    try {
      const reportRows = await fetchRows();

      downloadExcel(
        "diferencias_inventario.xlsx",
        reportRows.map((row) => ({
          Sucursal: row.store_name,
          Producto: row.product_name,
          Sistema: row.system_stock,
          Conteo: row.counted_stock,
          Diferencia: row.difference,
        }))
      );
    } catch {
      setError("No se pudo exportar el reporte de diferencias de inventario.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Diferencias de Inventario</h1>
      </div>

      <div className="rounded border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <label className="mb-1 block text-sm font-medium">
              Sucursal
            </label>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="all">Todas</option>

              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Consultando..." : "Consultar"}
          </button>

          <button
            type="button"
            onClick={exportReport}
            disabled={loading}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            Exportar Excel
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded border bg-white p-4">
        {loading ? (
          <p>Cargando...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay diferencias de inventario para mostrar.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-center">Sucursal</th>
                <th className="text-center">Producto</th>
                <th className="text-center">Sistema</th>
                <th className="text-center">Conteo</th>
                <th className="text-center">Diferencia</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={`${row.cash_session_id}-${row.product_id}`}>
                  <td className="text-center">{row.store_name}</td>
                  <td className="text-center">{row.product_name}</td>
                  <td className="text-center">{row.system_stock}</td>
                  <td className="text-center">{row.counted_stock}</td>
                  <td
                    className={`text-center font-semibold ${
                      row.difference > 0
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    {row.difference}
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