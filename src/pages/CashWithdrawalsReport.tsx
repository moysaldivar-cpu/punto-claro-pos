import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadExcel } from "@/lib/export";

type StoreOption = {
  id: string;
  name: string;
};

type UserOption = {
  id: string;
  nombre: string;
};

type WithdrawalRow = {
  withdrawal_id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  user_id: string | null;
  user_name: string;
  amount: number;
  reason: string | null;
  breakdown: string | null;
};

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseDatabaseDate(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

function formatDateTime(value: string) {
  return parseDatabaseDate(value).toLocaleString();
}

export default function CashWithdrawalsReport() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return toDateTimeLocal(date);
  });

  const [to, setTo] = useState(() => toDateTimeLocal(new Date()));

  const [storeFilter, setStoreFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    setLoadingOptions(true);
    setError(null);

    const [storesResult, usersResult] = await Promise.all([
      supabase
        .from("pos_stores")
        .select("id, name")
        .order("name"),
      supabase
        .from("pos_users")
        .select("id, nombre")
        .order("nombre"),
    ]);

    const firstError = storesResult.error || usersResult.error;

    if (firstError) {
      console.error("Error loading cash withdrawal report options:", firstError);
      setError("No se pudieron cargar los filtros del reporte.");
      setLoadingOptions(false);
      return;
    }

    setStores((storesResult.data ?? []) as StoreOption[]);
    setUsers((usersResult.data ?? []) as UserOption[]);
    setLoadingOptions(false);
  }

  async function loadReport() {
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
      setError("El rango de fechas no es valido.");
      return;
    }

    if (fromDate > toDate) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    setLoadingReport(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "get_cash_withdrawal_report",
      {
        p_from: fromDate.toISOString(),
        p_to: toDate.toISOString(),
        p_store_id: storeFilter || null,
        p_user_id: userFilter || null,
      }
    );

    if (rpcError) {
      console.error("Error loading cash withdrawal report:", rpcError);
      setRows([]);
      setError("No se pudo cargar el reporte de retiros.");
      setLoadingReport(false);
      return;
    }

    setRows((data ?? []) as WithdrawalRow[]);
    setLoadingReport(false);
  }

  function clearFilters() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    setFrom(toDateTimeLocal(start));
    setTo(toDateTimeLocal(new Date()));
    setStoreFilter("");
    setUserFilter("");
    setRows([]);
    setError(null);
  }

  function exportReport() {
    downloadExcel(
      "reporte_retiros_efectivo.xlsx",
      rows.map((row) => ({
        Fecha_Hora: formatDateTime(row.created_at),
        Sucursal: row.store_name,
        Usuario: row.user_name,
        Monto: Number(row.amount || 0),
        Motivo: row.reason ?? "",
        Desglose: row.breakdown ?? "",
      }))
    );
  }

  const totalAmount = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0
      ),
    [rows]
  );

  if (loadingOptions) {
    return <div>Cargando reporte de retiros...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Reporte de Retiros de Efectivo
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Consulta los retiros registrados por fecha, sucursal y usuario.
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

          <div className="flex items-end gap-2 xl:col-span-4">
            <button
              type="button"
              onClick={loadReport}
              disabled={loadingReport}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loadingReport ? "Consultando..." : "Consultar"}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              disabled={loadingReport}
              className="rounded border px-4 py-2 text-sm"
            >
              Limpiar
            </button>

            <button
              type="button"
              onClick={exportReport}
              disabled={loadingReport || rows.length === 0}
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
          Retiros: <strong>{rows.length}</strong>
        </span>
        <span>
          Total retirado:{" "}
          <strong>
            ${totalAmount.toLocaleString("es-MX", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </span>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="border-b px-3 py-2">Fecha / Hora</th>
              <th className="border-b px-3 py-2">Sucursal</th>
              <th className="border-b px-3 py-2">Usuario</th>
              <th className="border-b px-3 py-2 text-right">Monto</th>
              <th className="border-b px-3 py-2">Motivo</th>
              <th className="border-b px-3 py-2">Desglose</th>
            </tr>
          </thead>

          <tbody>
            {!loadingReport && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Consulta un rango para ver los retiros.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.withdrawal_id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2">
                  {formatDateTime(row.created_at)}
                </td>

                <td className="px-3 py-2">{row.store_name}</td>

                <td className="px-3 py-2">{row.user_name}</td>

                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  ${Number(row.amount || 0).toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>

                <td className="px-3 py-2">
                  {row.reason || "\u2014"}
                </td>

                <td className="px-3 py-2">
                  {row.breakdown || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}