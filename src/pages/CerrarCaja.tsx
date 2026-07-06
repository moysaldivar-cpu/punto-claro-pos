import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";
import beerZoneLogo from "@/assets/beer-zone-logo.png";

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

type CashDenominationKey =
  | "1000"
  | "500"
  | "200"
  | "100"
  | "50"
  | "20"
  | "10"
  | "5"
  | "2"
  | "1"
  | "0.5"
  | "0.2"
  | "0.1";

type CashDenominationCounts = Record<CashDenominationKey, string>;

type CloseTicketData = {
  sessionId: string;
  closedAt: string;
  exchangeRate: number;
  realCash: number;
  realCard: number;
  realUsd: number;
  declaredGeneral: number;
  emptyCoronaBoxes: number;
  emptyHeinekenBoxes: number;
  denominationRows: {
    key: CashDenominationKey;
    label: string;
    count: number;
    subtotal: number;
  }[];
};

const CASH_DENOMINATIONS: {
  key: CashDenominationKey;
  value: number;
  label: string;
}[] = [
  { key: "1000", value: 1000, label: "$1000" },
  { key: "500", value: 500, label: "$500" },
  { key: "200", value: 200, label: "$200" },
  { key: "100", value: 100, label: "$100" },
  { key: "50", value: 50, label: "$50" },
  { key: "20", value: 20, label: "$20" },
  { key: "10", value: 10, label: "$10 moneda" },
  { key: "5", value: 5, label: "$5 moneda" },
  { key: "2", value: 2, label: "$2 moneda" },
  { key: "1", value: 1, label: "$1 moneda" },
  { key: "0.5", value: 0.5, label: "$0.50" },
  { key: "0.2", value: 0.2, label: "$0.20" },
  { key: "0.1", value: 0.1, label: "$0.10" },
];

const EMPTY_DENOMINATION_COUNTS: CashDenominationCounts = {
  "1000": "",
  "500": "",
  "200": "",
  "100": "",
  "50": "",
  "20": "",
  "10": "",
  "5": "",
  "2": "",
  "1": "",
  "0.5": "",
  "0.2": "",
  "0.1": "",
};

export default function CloseCashSession() {
  const { logout, user } = usePosAuth();

  const storeId = user?.store_id || localStorage.getItem("store_id");

  const role = String(
    (user as any)?.rol ?? (user as any)?.role ?? "cajero"
  ).toLowerCase();

  const isAdmin = role === "admin";
  const showCashDifferences = role !== "cajero";

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [inventoryComparison, setInventoryComparison] = useState<ComparisonRow[]>(
    []
  );
  const [hasCounts, setHasCounts] = useState(false);

  const [cashCounts, setCashCounts] = useState<CashDenominationCounts>(
    EMPTY_DENOMINATION_COUNTS
  );
  const [realCard, setRealCard] = useState<string>("");
  const [realUsd, setRealUsd] = useState<string>("");

  const [emptyCoronaBoxes, setEmptyCoronaBoxes] = useState<string>("");
  const [emptyHeinekenBoxes, setEmptyHeinekenBoxes] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [closeTicket, setCloseTicket] = useState<CloseTicketData | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      if (!storeId) {
        setError("No hay sucursal activa para esta sesión.");
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setError("No hay usuario activo para esta sesión.");
        setLoading(false);
        return;
      }

      const { data: session, error: sessionError } = await supabase
        .from("cash_sessions")
        .select("id, exchange_rate, store_id, opened_by")
        .eq("store_id", storeId)
        .eq("opened_by", user.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        setError("Error al cargar sesión abierta: " + sessionError.message);
        setLoading(false);
        return;
      }

      if (!session) {
        const { data: otherSession } = await supabase
          .from("cash_sessions")
          .select("id, opened_by")
          .eq("store_id", storeId)
          .eq("status", "open")
          .neq("opened_by", user.id)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (otherSession) {
          setError(
            "Esta sucursal tiene un turno abierto por otro usuario. Para cerrar caja aquí, debe ingresar el usuario que abrió ese turno."
          );
        } else {
          setError("No hay sesión abierta para este usuario en esta sucursal.");
        }

        setLoading(false);
        return;
      }

      setSessionId(session.id);
      setExchangeRate(Number(session.exchange_rate || 0));

      const { data: totalsData, error: totalsError } = await supabase.rpc(
        "get_cash_session_totals",
        {
          p_session_id: session.id,
        }
      );

      if (totalsError) {
        setError("Error al cargar totales del turno: " + totalsError.message);
        setLoading(false);
        return;
      }

      const totalsRows = Array.isArray(totalsData)
        ? (totalsData as Totals[])
        : totalsData
        ? ([totalsData] as Totals[])
        : [];

      if (totalsRows.length > 0) {
        setTotals({
          total_cash_mxn: Number(totalsRows[0].total_cash_mxn || 0),
          total_card_mxn: Number(totalsRows[0].total_card_mxn || 0),
          total_usd: Number(totalsRows[0].total_usd || 0),
          total_general_mxn: Number(totalsRows[0].total_general_mxn || 0),
        });
      } else {
        setTotals({
          total_cash_mxn: 0,
          total_card_mxn: 0,
          total_usd: 0,
          total_general_mxn: 0,
        });
      }

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("product_id, stock")
        .eq("store_id", session.store_id);

      if (inventoryError) {
        setError("Error al cargar inventario: " + inventoryError.message);
        setLoading(false);
        return;
      }

      const { data: countsData, error: countsError } = await supabase
        .from("inventory_counts")
        .select("product_id, fridge_qty, warehouse_qty")
        .eq("cash_session_id", session.id);

      if (countsError) {
        setError("Error al cargar conteo de turno: " + countsError.message);
        setLoading(false);
        return;
      }

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name");

      if (productsError) {
        setError("Error al cargar productos: " + productsError.message);
        setLoading(false);
        return;
      }

      const typedInventoryData = (inventoryData || []) as InventoryRow[];
      const typedCountsData = (countsData || []) as CountRow[];
      const typedProductsData = (productsData || []) as ProductRow[];

      if (typedCountsData.length > 0) {
        setHasCounts(true);

        const comparison: ComparisonRow[] = typedInventoryData.map((inv) => {
          const count = typedCountsData.find(
            (c) => c.product_id === inv.product_id
          );
          const product = typedProductsData.find((p) => p.id === inv.product_id);

          const realStock =
            Number(count?.fridge_qty || 0) + Number(count?.warehouse_qty || 0);

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
  }, [storeId, user?.id]);

  const denominationRows = useMemo(() => {
    return CASH_DENOMINATIONS.map((denomination) => {
      const count = Number(cashCounts[denomination.key] || 0);
      const subtotal = count * denomination.value;

      return {
        ...denomination,
        count,
        subtotal,
      };
    });
  }, [cashCounts]);

  const realCashNumber = useMemo(() => {
    const total = denominationRows.reduce((acc, row) => acc + row.subtotal, 0);
    return Number(total.toFixed(2));
  }, [denominationRows]);

  const inventoryRowsWithDifferences = useMemo(() => {
    return inventoryComparison.filter((row) => row.difference !== 0);
  }, [inventoryComparison]);

  const realCardNumber = Number(realCard) || 0;
  const realUsdNumber = Number(realUsd) || 0;

  const emptyCoronaBoxesNumber = Number(emptyCoronaBoxes) || 0;
  const emptyHeinekenBoxesNumber = Number(emptyHeinekenBoxes) || 0;

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

  function capturedAmountClass(value: number) {
    if (value > 0) return "text-green-600";
    return "text-gray-900";
  }

  function declaredTotalClass() {
    return "text-gray-900";
  }

  function normalizeNonNegativeInteger(value: string) {
    if (value === "") return "";

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return Math.floor(parsed).toString();
  }

  function handleCashCountChange(key: CashDenominationKey, value: string) {
    const normalized = normalizeNonNegativeInteger(value);

    if (normalized === null) return;

    setCashCounts((prev) => ({
      ...prev,
      [key]: normalized,
    }));
  }

  function handleDecimalChange(
    value: string,
    setter: (nextValue: string) => void
  ) {
    if (value === "") {
      setter("");
      return;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    setter(value);
  }

  function handleEmptyCoronaBoxesChange(value: string) {
    const normalized = normalizeNonNegativeInteger(value);

    if (normalized === null) return;

    setEmptyCoronaBoxes(normalized);
  }

  function handleEmptyHeinekenBoxesChange(value: string) {
    const normalized = normalizeNonNegativeInteger(value);

    if (normalized === null) return;

    setEmptyHeinekenBoxes(normalized);
  }

  async function handleCloseSession() {
    if (!sessionId) return;

    if (!storeId) {
      setError("No hay sucursal activa para cerrar este turno.");
      return;
    }

    if (!user?.id) {
      setError("No hay usuario activo para cerrar este turno.");
      return;
    }

    setClosing(true);
    setError("");

    const { data: currentSession, error: currentSessionError } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("store_id", storeId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle();

    if (currentSessionError) {
      setError("Error al validar turno: " + currentSessionError.message);
      setClosing(false);
      return;
    }

    if (!currentSession) {
      setError(
        "El turno ya no está abierto para este usuario en esta sucursal. Actualiza la pantalla y vuelve a intentar."
      );
      setClosing(false);
      return;
    }

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

    setCloseTicket({
      sessionId,
      closedAt: new Date().toISOString(),
      exchangeRate,
      realCash: realCashNumber,
      realCard: realCardNumber,
      realUsd: realUsdNumber,
      declaredGeneral: Number(declaredGeneral.toFixed(2)),
      emptyCoronaBoxes: emptyCoronaBoxesNumber,
      emptyHeinekenBoxes: emptyHeinekenBoxesNumber,
      denominationRows,
    });

    setClosing(false);
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando información del turno.</div>;
  }

  if (error && !closing) {
    return <div className="p-6 text-red-600 font-semibold">{error}</div>;
  }

  return (
    <>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Cierre de Turno</h1>

        {totals && (
          <>
            {showCashDifferences && (
              <div className="bg-white shadow rounded p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Resumen del Turno</h2>

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
            )}

            <div className="bg-white shadow rounded p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Conteo de Efectivo</h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Denominación</th>
                      <th className="text-right p-2">Cantidad</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {CASH_DENOMINATIONS.map((denomination) => {
                      const row = denominationRows.find(
                        (item) => item.key === denomination.key
                      );

                      return (
                        <tr key={denomination.key} className="border-b">
                          <td className="p-2">{denomination.label}</td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              value={cashCounts[denomination.key]}
                              onChange={(event) =>
                                handleCashCountChange(
                                  denomination.key,
                                  event.target.value
                                )
                              }
                              className="border rounded px-2 py-1 w-24 text-right"
                            />
                          </td>
                          <td className="p-2 text-right">
                            {money(row?.subtotal || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-between text-lg font-bold">
                <span>Total efectivo capturado</span>
                <span className={capturedAmountClass(realCashNumber)}>
                  {money(realCashNumber)}
                </span>
              </div>
            </div>

            <div className="bg-white shadow rounded p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Otros Pagos Capturados</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">
                    Tarjeta capturada (MXN)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={realCard}
                    onChange={(event) =>
                      handleDecimalChange(event.target.value, setRealCard)
                    }
                    className="border rounded px-3 py-2 w-full"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium mb-1">
                    USD capturados
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    value={realUsd}
                    onChange={(event) =>
                      handleDecimalChange(event.target.value, setRealUsd)
                    }
                    className="border rounded px-3 py-2 w-full"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-between text-lg font-bold">
                <span>Total declarado del cierre (MXN)</span>
                <span className={declaredTotalClass()}>
                  {money(declaredGeneral)}
                </span>
              </div>
            </div>

            <div className="bg-white shadow rounded p-6 mb-6">
              <h2 className="text-lg font-semibold mb-2">
                Cajas Vacías
              </h2>

              <p className="text-sm text-gray-600 mb-4">
                Dato informativo. No afecta efectivo, tarjeta, USD, total declarado,
                inventario ni reportes.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">
                    Cajas vacías Corona
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={emptyCoronaBoxes}
                    onChange={(event) =>
                      handleEmptyCoronaBoxesChange(event.target.value)
                    }
                    className="border rounded px-3 py-2 w-full"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-medium mb-1">
                    Cajas vacías Heineken
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={emptyHeinekenBoxes}
                    onChange={(event) =>
                      handleEmptyHeinekenBoxesChange(event.target.value)
                    }
                    className="border rounded px-3 py-2 w-full"
                  />
                </label>
              </div>
            </div>

            {showCashDifferences && (
              <div className="bg-white shadow rounded p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Diferencias de Caja</h2>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Efectivo capturado</span>
                    <span>{money(realCashNumber)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Diferencia efectivo</span>
                    <span className={diffClass(cashDifference)}>
                      {money(cashDifference)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Tarjeta capturada</span>
                    <span>{money(realCardNumber)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Diferencia tarjeta</span>
                    <span className={diffClass(cardDifference)}>
                      {money(cardDifference)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>USD capturados</span>
                    <span>{usd(realUsdNumber)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Diferencia USD</span>
                    <span className={diffClass(usdDifference)}>
                      {usd(usdDifference)}
                    </span>
                  </div>

                  <div className="flex justify-between pt-2 border-t">
                    <span>Total declarado (MXN)</span>
                    <span className={declaredTotalClass()}>
                      {money(declaredGeneral)}
                    </span>
                  </div>

                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Diferencia general (MXN)</span>
                    <span className={diffClass(generalDifference)}>
                      {money(generalDifference)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white shadow rounded p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">
                  Diferencias de Inventario
                </h2>

                {!hasCounts ? (
                  <div className="text-sm text-gray-600">
                    No hubo conteo de turno para esta sesión, por lo tanto no se
                    puede calcular una comparación real de inventario en este cierre.
                  </div>
                ) : inventoryRowsWithDifferences.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    No hay diferencias de inventario para mostrar. Todos los
                    productos capturados coinciden con el sistema.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
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
                        {inventoryRowsWithDifferences.map((row) => (
                          <tr key={row.product_id} className="border-b">
                            <td className="p-2">{row.name}</td>
                            <td className="text-right p-2">{row.system_stock}</td>
                            <td className="text-right p-2">{row.real_stock}</td>
                            <td
                              className={`text-right p-2 font-semibold ${
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
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded p-4 mb-6">
                {error}
              </div>
            )}

            <button
              onClick={handleCloseSession}
              disabled={closing}
              className="w-full bg-red-600 text-white py-3 rounded font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {closing ? "Cerrando turno." : "Cerrar Turno"}
            </button>

            {closing && (
              <div className="text-sm text-gray-500 mt-2">
                Procesando cierre.
              </div>
            )}
          </>
        )}
      </div>

      {closeTicket && (
        <CloseTicketModal
          ticket={closeTicket}
          onClose={() => {
            setCloseTicket(null);
            logout();
          }}
        />
      )}
    </>
  );
}

function CloseTicketModal({
  ticket,
  onClose,
}: {
  ticket: CloseTicketData;
  onClose: () => void;
}) {
  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function usd(value: number) {
    return `$${Number(value || 0).toFixed(4)}`;
  }

  const positiveDenominationRows = ticket.denominationRows.filter(
    (row) => row.count > 0
  );

  const hasEmptyBoxes =
    ticket.emptyCoronaBoxes > 0 || ticket.emptyHeinekenBoxes > 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrintShortcut =
        event.key === "F1" ||
        (event.ctrlKey &&
          event.altKey &&
          event.key.toLowerCase() === "i");

      if (isPrintShortcut) {
        event.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={beerZoneLogo}
            alt="Beer Zone marca de agua"
            className="w-64 opacity-5 object-contain"
          />
        </div>

        <div className="relative z-10">
          <div className="text-center mb-4">
            <img
              src={beerZoneLogo}
              alt="Beer Zone"
              className="mx-auto h-20 object-contain mb-2"
            />
            <h2 className="text-2xl font-bold">BEER ZONE</h2>
            <p className="text-sm font-medium">CIERRE DE TURNO</p>
          </div>

          <div className="mb-4 text-sm space-y-1">
            <div>
              <span className="font-semibold">Sesión:</span> {ticket.sessionId}
            </div>

            <div>
              <span className="font-semibold">Fecha:</span>{" "}
              {new Date(ticket.closedAt).toLocaleString()}
            </div>

            <div>
              <span className="font-semibold">Tipo de cambio:</span>{" "}
              {ticket.exchangeRate.toFixed(4)}
            </div>
          </div>

          <div className="border-t border-b py-3 mb-4">
            <h3 className="font-semibold mb-2">Detalle de efectivo</h3>

            {positiveDenominationRows.length === 0 ? (
              <div className="text-sm text-gray-600">
                Sin efectivo capturado por denominación.
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                {positiveDenominationRows.map((row) => (
                  <div key={row.key} className="flex justify-between">
                    <span>
                      {row.label} x {row.count}
                    </span>
                    <span>{money(row.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between font-bold mt-2 pt-2 border-t">
              <span>Total efectivo</span>
              <span>{money(ticket.realCash)}</span>
            </div>
          </div>

          <div className="border-b pb-3 mb-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Tarjeta capturada</span>
              <span>{money(ticket.realCard)}</span>
            </div>

            <div className="flex justify-between">
              <span>USD capturados</span>
              <span>{usd(ticket.realUsd)}</span>
            </div>

            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Total declarado (MXN)</span>
              <span>{money(ticket.declaredGeneral)}</span>
            </div>
          </div>

          <div className="border-b pb-3 mb-4 text-sm">
            <h3 className="font-semibold mb-2">
              Cajas vacías capturadas
            </h3>

            {!hasEmptyBoxes ? (
              <div className="text-gray-600">Sin cajas vacías capturadas.</div>
            ) : (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Corona</span>
                  <span>{ticket.emptyCoronaBoxes}</span>
                </div>

                <div className="flex justify-between">
                  <span>Heineken</span>
                  <span>{ticket.emptyHeinekenBoxes}</span>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500 mt-2">
              Dato informativo. No afecta caja, inventario ni reportes.
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 mb-4">
            Presiona F1 o Ctrl + Alt + I para imprimir.
          </div>

          <div className="flex gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 bg-gray-900 text-white py-2 rounded font-semibold hover:bg-gray-800"
            >
              Imprimir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-red-600 text-white py-2 rounded font-semibold hover:bg-red-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}