import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadExcel } from "@/lib/export";

type StoreOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  nombre: string;
};

type MovementRow = {
  movement_id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  stock_before: number | null;
  quantity: number;
  stock_after: number | null;
  movement_type: string;
  movement_category: string | null;
  user_id: string | null;
  user_name: string;
  reason: string | null;
};

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function InventoryHistory() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return toDateTimeLocal(date);
  });

  const [to, setTo] = useState(() => toDateTimeLocal(new Date()));

  const [storeFilter, setStoreFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    setLoadingOptions(true);
    setError(null);

    const [storesResult, productsResult, usersResult] = await Promise.all([
      supabase
        .from("pos_stores")
        .select("id, name")
        .order("name"),
      supabase
        .from("products")
        .select("id, name")
        .order("name"),
      supabase
        .from("pos_users")
        .select("id, nombre")
        .order("nombre"),
    ]);

    const firstError =
      storesResult.error ||
      productsResult.error ||
      usersResult.error;

    if (firstError) {
      console.error("Error loading inventory history options:", firstError);
      setError("No se pudieron cargar los filtros del historial.");
      setLoadingOptions(false);
      return;
    }

    setStores((storesResult.data ?? []) as StoreOption[]);
    setProducts((productsResult.data ?? []) as ProductOption[]);
    setUsers((usersResult.data ?? []) as UserOption[]);
    setLoadingOptions(false);
  }

  async function loadHistory() {
    if (!from || !to) {
      setError("Selecciona fecha y hora de inicio y fin.");
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDate.getTime())
    ) {
      setError("El rango de fechas no es válido.");
      return;
    }

    if (fromDate > toDate) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    setLoadingHistory(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "get_inventory_movement_history",
      {
        p_from: fromDate.toISOString(),
        p_to: toDate.toISOString(),
        p_store_id: storeFilter || null,
        p_product_id: productFilter || null,
        p_user_id: userFilter || null,
        p_movement_type: typeFilter || null,
      }
    );

    if (rpcError) {
      console.error("Error loading inventory history:", rpcError);
      setRows([]);
      setError("No se pudo cargar el historial de movimientos.");
      setLoadingHistory(false);
      return;
    }

    setRows((data ?? []) as MovementRow[]);
    setLoadingHistory(false);
  }

  function clearFilters() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    setFrom(toDateTimeLocal(start));
    setTo(toDateTimeLocal(new Date()));
    setStoreFilter("");
    setProductFilter("");
    setUserFilter("");
    setTypeFilter("");
    setRows([]);
    setError(null);
  }

  function exportHistory() {
    downloadExcel(
      "historial_movimientos_inventario.xlsx",
      rows.map((row) => ({
        Fecha_Hora: new Date(row.created_at).toLocaleString(),
        Sucursal: row.store_name,
        Producto: row.product_name,
        Habia: row.stock_before ?? "",
        Tipo: row.movement_type,
        Cantidad: row.quantity,
        Quedo: row.stock_after ?? "",
        Usuario: row.user_name,
        Motivo: row.reason ?? "",
      }))
    );
  }

  const totalUnits = useMemo(
    () => rows.reduce((sum, row) => sum + Math.abs(Number(row.quantity || 0)), 0),
    [rows]
  );

  if (loadingOptions) {
    return <div>Cargando historial de movimientos...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Historial de movimientos de inventario
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Consulta entradas, salidas, ajustes, ventas, mermas y devoluciones.
        </p>
      </div>

      <div className="rounded border bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Desde
            </label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Hasta
            </label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Sucursal
            </label>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Producto
            </label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Usuario
            </label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tipo de movimiento
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
              <option value="Ajuste">Ajuste</option>
              <option value="Venta">Venta</option>
              <option value="Merma">Merma</option>
              <option value="Cancelación">Cancelación</option>
              <option value="Devolución">Devolución</option>
            </select>
          </div>

          <div className="flex items-end gap-2 xl:col-span-2">
            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loadingHistory ? "Consultando..." : "Consultar"}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              disabled={loadingHistory}
              className="rounded border px-4 py-2 text-sm"
            >
              Limpiar
            </button>

            <button
              type="button"
              onClick={exportHistory}
              disabled={loadingHistory || rows.length === 0}
              className="rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              Exportar Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <span>
          Movimientos: <strong>{rows.length}</strong>
        </span>
        <span>
          Unidades involucradas: <strong>{totalUnits}</strong>
        </span>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="border-b px-3 py-2">Fecha / Hora</th>
              <th className="border-b px-3 py-2">Sucursal</th>
              <th className="border-b px-3 py-2">Producto</th>
              <th className="border-b px-3 py-2 text-right">Había</th>
              <th className="border-b px-3 py-2">Tipo</th>
              <th className="border-b px-3 py-2 text-right">Cantidad</th>
              <th className="border-b px-3 py-2 text-right">Quedó</th>
              <th className="border-b px-3 py-2">Usuario</th>
              <th className="border-b px-3 py-2">Motivo</th>
            </tr>
          </thead>

          <tbody>
            {!loadingHistory && rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Consulta un rango para ver los movimientos.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.movement_id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2">
                  {new Date(row.created_at).toLocaleString()}
                </td>

                <td className="px-3 py-2">{row.store_name}</td>

                <td className="px-3 py-2">{row.product_name}</td>

                <td className="px-3 py-2 text-right">
                  {row.stock_before ?? "—"}
                </td>

                <td className="px-3 py-2">
                  {row.movement_type}
                </td>

                <td
                  className={`px-3 py-2 text-right font-medium ${
                    row.quantity < 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                </td>

                <td className="px-3 py-2 text-right">
                  {row.stock_after ?? "—"}
                </td>

                <td className="px-3 py-2">{row.user_name}</td>

                <td className="px-3 py-2">
                  {row.reason || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
