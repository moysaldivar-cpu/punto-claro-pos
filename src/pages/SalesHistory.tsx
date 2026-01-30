import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type Sale = {
  id: string;
  created_at: string;
  store_id: string;
  total: number;
  payment_method: string;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
  user_name: string;
};

export default function SalesHistory() {
  const { role, loadingRole } = useAuth();
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadSales();
    }
  }, [isAdmin]);

  async function loadSales() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        created_at,
        store_id,
        total,
        payment_method,
        payment_cash,
        payment_card,
        payment_usd,
        user_name
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) {
      setError("No se pudo cargar el historial de ventas");
      setLoading(false);
      return;
    }

    setSales(data);
    setLoading(false);
  }

  if (loadingRole || loading) {
    return <div className="p-6">Cargando ventas…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-red-600">
        No tienes permiso para ver el historial de ventas.
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">
        Historial de ventas
      </h1>

      <table className="w-full border">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Usuario</th>
            <th className="p-2 text-center">Método</th>
            <th className="p-2 text-center">Total</th>
            <th className="p-2 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b">
              <td className="p-2">
                {new Date(sale.created_at).toLocaleString()}
              </td>
              <td className="p-2">{sale.user_name}</td>
              <td className="p-2 text-center">
                {sale.payment_method}
              </td>
              <td className="p-2 text-center font-semibold">
                ${sale.total}
              </td>
              <td className="p-2 text-center">
                <Link
                  to={`/app/sales/${sale.id}`}
                  className="text-blue-600 underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 text-sm text-gray-500">
        Haz clic en “Ver detalle” para ver los productos de la venta.
      </div>
    </div>
  );
}
