import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/lib/useRole";

type InventoryLog = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
};

export default function Inventory() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  const { role, loadingRole } = useRole(userId);
  const isAdminRole = role === "admin" || role === "gerente";

  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    if (!loadingRole && isAdminRole) {
      loadLogs();
    }
  }, [loadingRole, isAdminRole]);

  async function loadLogs() {
    setLoadingLogs(true);
    setError(null);

    const { data, error } = await supabase
      .from("inventory_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      console.error("ERROR INVENTORY_LOGS:", error);
      setError(error?.message ?? "No se pudo leer inventory_logs");
      setLoadingLogs(false);
      return;
    }

    setLogs(data);
    setLoadingLogs(false);
  }

  if (loading || loadingRole || loadingLogs) {
    return <div className="p-6">Cargando inventario…</div>;
  }

  if (!isAdminRole) {
    return (
      <div className="p-6 text-red-600">
        No tienes permiso para ver el historial de inventario.
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">
        Historial de movimientos de inventario
      </h1>

      <table className="w-full border">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-center">Movimiento</th>
            <th className="p-2 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">
              <td className="p-2">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td
                className={`p-2 text-center font-semibold ${
                  log.delta > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {log.delta > 0 ? `+${log.delta}` : log.delta}
              </td>
              <td className="p-2">{log.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 text-sm text-gray-500">
        Mostrando los últimos 100 movimientos.
      </div>
    </div>
  );
}
