import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";

type Totals = {
  total_cash_mxn: number;
  total_card_mxn: number;
  total_usd: number;
  total_general_mxn: number;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type CountRow = {
  product_id: string;
  fridge_qty: number;
  warehouse_qty: number;
};

type ProductRow = {
  id: string;
  name: string;
};

type ComparisonRow = {
  product_id: string;
  name: string;
  system_stock: number;
  real_stock: number;
  difference: number;
};

export default function CloseCashSession() {
  const { logout } = usePosAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [inventoryComparison, setInventoryComparison] = useState<ComparisonRow[]>([]);
  const [hasCounts, setHasCounts] = useState(false);

  const [realCash, setRealCash] = useState<string>("");
  const [realCard, setRealCard] = useState<string>("");
  const [realUsd, setRealUsd] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const { data: session } = await supabase
        .from("cash_sessions")
        .select("id, exchange_rate, store_id")
        .eq("status", "open")
        .maybeSingle();

      if (!session) {
        setError("No hay sesión abierta");
        setLoading(false);
        return;
      }

      setSessionId(session.id);
      setExchangeRate(Number(session.exchange_rate || 0));

      const { data: totalsData } = await supabase.rpc(
        "get_cash_session_totals",
        { p_session_id: session.id }
      );

      if (totalsData && totalsData.length > 0) {
        setTotals(totalsData[0]);
      }

      const { data: inventoryData } = await supabase
        .from("inventory")
        .select("product_id, stock")
        .eq("store_id", session.store_id);

      const { data: countsData } = await supabase
        .from("inventory_counts")
        .select("product_id, fridge_qty, warehouse_qty")
        .eq("cash_session_id", session.id);

      const { data: productsData } = await supabase
        .from("products")
        .select("id, name");

      const typedInventoryData = (inventoryData || []) as InventoryRow[];
      const typedCountsData = (countsData || []) as CountRow[];
      const typedProductsData = (productsData || []) as ProductRow[];

      if (typedCountsData.length > 0) {
        setHasCounts(true);

        const comparison: ComparisonRow[] = typedInventoryData.map((inv) => {
          const count = typedCountsData.find((c) => c.product_id === inv.product_id);
          const product = typedProductsData.find((p) => p.id === inv.product_id);

          const realStock =
            Number(count?.fridge_qty || 0) +
            Number(count?.warehouse_qty || 0);

          return {
            product_id: inv.product_id,
            name: product?.name || "Producto",
            system_stock: Number(inv.stock || 0),
            real_stock: realStock,
            difference: Number(inv.stock || 0) - realStock,
          };
        });

        setInventoryComparison(comparison);
      } else {
        setHasCounts(false);
        setInventoryComparison([]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const realCashNumber = Number(realCash) || 0;
  const realCardNumber = Number(realCard) || 0;
  const realUsdNumber = Number(realUsd) || 0;

  const expectedCash = totals?.total_cash_mxn || 0;
  const expectedCard = totals?.total_card_mxn || 0;
  const expectedUsd = totals?.total_usd || 0;
  const expectedGeneral = totals?.total_general_mxn || 0;

  const cashDifference = realCashNumber - expectedCash;
  const cardDifference = realCardNumber - expectedCard;
  const usdDifference = realUsdNumber - expectedUsd;

  const declaredGeneral =
    realCashNumber + realCardNumber + realUsdNumber * exchangeRate;

  const generalDifference = declaredGeneral - expectedGeneral;

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function usd(value: number) {
    return `$${Number(value || 0).toFixed(4)}`;
  }

  function diffClass(value: number) {
    if (value === 0) return "text-green-600";
    if (value > 0) return "text-blue-600";
    return "text-red-600";
  }

  async function handleCloseSession() {
    if (!sessionId) return;

    setClosing(true);
    setError("");

    const { error } = await supabase.rpc("close_cash_session", {
      p_session_id: sessionId,
      p_real_cash: realCashNumber,
      p_real_card: realCardNumber,
      p_real_usd: realUsdNumber,
    });

    if (error) {
      setError(error.message);
      setClosing(false);
      return;
    }

    alert("Turno cerrado correctamente ✅");
    logout();
  }

  if (loading) {
    return (
      <div className="p-6 text-gray-500">
        Cargando información del turno...
      </div>
    );
  }

  if (error && !closing) {
    return (
      <div className="p-6 text-red-600 font-semibold">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">
        Cierre de Turno
      </h1>

      {totals && (
        <>
          <div className="bg-white shadow rounded p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Resumen del Turno
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Efectivo esperado</span>
                <span>{money(expectedCash)}</span>
              </div>

              <div className="flex justify-between">
                <span>Tarjeta esperada</span>
                <span>{money(expectedCard)}</span>
              </div>

              <div className="flex justify-between">
                <span>USD esperados</span>
                <span>{usd(expectedUsd)}</span>
              </div>

              <div className="flex justify-between">
                <span>Tipo de cambio</span>
                <span>{exchangeRate.toFixed(4)}</span>
              </div>

              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total general esperado (MXN)</span>
                <span>{money(expectedGeneral)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Captura real de cierre
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Efectivo real</label>
                <input
                  type="number"
                  step="0.01"
                  className="border p-2 w-full rounded"
                  value={realCash}
                  onChange={(e) => setRealCash(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Tarjeta real</label>
                <input
                  type="number"
                  step="0.01"
                  className="border p-2 w-full rounded"
                  value={realCard}
                  onChange={(e) => setRealCard(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">USD reales</label>
                <input
                  type="number"
                  step="0.0001"
                  className="border p-2 w-full rounded"
                  value={realUsd}
                  onChange={(e) => setRealUsd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Diferencias de caja
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Diferencia efectivo</span>
                <span className={diffClass(cashDifference)}>
                  {money(cashDifference)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Diferencia tarjeta</span>
                <span className={diffClass(cardDifference)}>
                  {money(cardDifference)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Diferencia USD</span>
                <span className={diffClass(usdDifference)}>
                  {usd(usdDifference)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Total declarado (MXN)</span>
                <span>{money(declaredGeneral)}</span>
              </div>

              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Diferencia general (MXN)</span>
                <span className={diffClass(generalDifference)}>
                  {money(generalDifference)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Diferencias de Inventario
            </h2>

            {!hasCounts ? (
              <div className="text-sm text-gray-600">
                No hubo conteo de turno para esta sesión, por lo tanto no se puede
                calcular una comparación real de inventario en este cierre.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Producto</th>
                    <th className="text-right p-2">Sistema</th>
                    <th className="text-right p-2">Conteo</th>
                    <th className="text-right p-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryComparison.map((row) => (
                    <tr key={row.product_id} className="border-b">
                      <td className="p-2">{row.name}</td>
                      <td className="text-right p-2">{row.system_stock}</td>
                      <td className="text-right p-2">{row.real_stock}</td>
                      <td
                        className={`text-right p-2 font-semibold ${
                          row.difference === 0
                            ? "text-green-600"
                            : row.difference > 0
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

          <button
            onClick={handleCloseSession}
            disabled={closing}
            className="w-full bg-red-600 text-white py-3 rounded font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {closing ? "Cerrando turno..." : "Cerrar Turno"}
          </button>

          {closing && (
            <div className="text-sm text-gray-500 mt-2">
              Procesando cierre...
            </div>
          )}
        </>
      )}
    </div>
  );
}