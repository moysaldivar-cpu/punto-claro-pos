import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MovementType = "in" | "out" | "adjustment";

type MovementRow = {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  created_at: string;
  product_name: string;
  user_email: string;
};

export default function InventoryHistory() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<"" | MovementType>("");
  const [productFilter, setProductFilter] = useState<string>("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory_movements")
      .select(
        `
        id,
        product_id,
        type,
        quantity,
        reason,
        created_at,
        products (
          name
        ),
        profiles (
          email
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading inventory history:", error);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped: MovementRow[] =
      (data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        type: r.type,
        quantity: r.quantity,
        reason: r.reason,
        created_at: r.created_at,
        product_name: r.products?.name ?? "(Sin producto)",
        user_email: r.profiles?.email ?? "(Sistema)",
      })) ?? [];

    setRows(mapped);
    setLoading(false);
  }

  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!map.has(r.product_id)) map.set(r.product_id, r.product_name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (productFilter && r.product_id !== productFilter) return false;
      return true;
    });
  }, [rows, typeFilter, productFilter]);

  function typeLabel(t: MovementType) {
    if (t === "in") return "entrada";
    if (t === "out") return "salida";
    return "ajuste";
  }

  if (loading) {
    return <div>Cargando historial…</div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold">Historial de inventario</h1>
          <p className="text-sm text-gray-500 mt-1">
            Movimientos auditables (entrada, salida y ajustes).
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="px-4 py-2 bg-black text-white rounded text-sm"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm mb-1">Producto</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="in">Entrada</option>
              <option value="out">Salida</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setProductFilter("");
                setTypeFilter("");
              }}
              className="px-4 py-2 border rounded text-sm"
            >
              Limpiar
            </button>

            <div className="ml-auto text-sm text-gray-600 flex items-center">
              {filteredRows.length} movimientos
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <table className="w-full border text-sm bg-white">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">Fecha</th>
            <th className="p-2">Producto</th>
            <th className="p-2">Tipo</th>
            <th className="p-2">Cantidad</th>
            <th className="p-2">Motivo</th>
            <th className="p-2">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center text-gray-500">
                Sin movimientos con los filtros actuales
              </td>
            </tr>
          )}

          {filteredRows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="p-2">{r.product_name}</td>
              <td className="p-2 capitalize">{typeLabel(r.type)}</td>
              <td
                className={`p-2 ${
                  r.quantity < 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {r.quantity}
              </td>
              <td className="p-2">{r.reason ?? "-"}</td>
              <td className="p-2">{r.user_email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
