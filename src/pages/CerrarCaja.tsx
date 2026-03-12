import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type OpenSession = {
  id: string;
  store_id: string;
  opened_at: string;
  opening_amount: number | string | null;
  exchange_rate: number | string | null;
  status: string;
};

type SaleRow = {
  id: string;
  total: number | string | null;
  payment_cash: number | string | null;
  payment_card: number | string | null;
  payment_usd: number | string | null;
  created_at: string;
};

export default function CerrarCaja() {
  const { user } = useAuth();

  const storeId = localStorage.getItem("store_id");

  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [usd, setUsd] = useState("");

  const [status, setStatus] = useState<null | "OK" | "NO_OPEN_CUT">(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<OpenSession | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);

  useEffect(() => {
    loadData();
  }, [storeId]);

  async function loadData() {
    if (!storeId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: openSession, error: sessionError } = await supabase
      .from("cash_sessions")
      .select("id, store_id, opened_at, opening_amount, exchange_rate, status")
      .eq("store_id", storeId)
      .eq("status", "open")
      .maybeSingle();

    if (sessionError) {
      alert("Error al cargar sesión abierta: " + sessionError.message);
      setLoading(false);
      return;
    }

    if (!openSession) {
      setSession(null);
      setSales([]);
      setLoading(false);
      return;
    }

    setSession(openSession);

    const { data: salesRows, error: salesError } = await supabase
      .from("sales")
      .select("id, total, payment_cash, payment_card, payment_usd, created_at")
      .eq("cash_session_id", openSession.id)
      .order("created_at", { ascending: true });

    if (salesError) {
      alert("Error al cargar ventas del turno: " + salesError.message);
      setLoading(false);
      return;
    }

    setSales(salesRows || []);
    setLoading(false);
  }

  const resumen = useMemo(() => {
    const openingAmount = Number(session?.opening_amount || 0);
    const exchangeRate = Number(session?.exchange_rate || 1);

    const salesCash = sales.reduce(
      (acc, row) => acc + Number(row.payment_cash || 0),
      0
    );

    const salesCard = sales.reduce(
      (acc, row) => acc + Number(row.payment_card || 0),
      0
    );

    const salesUsd = sales.reduce(
      (acc, row) => acc + Number(row.payment_usd || 0),
      0
    );

    const totalVentas = sales.reduce(
      (acc, row) => acc + Number(row.total || 0),
      0
    );

    const expectedCash = openingAmount + salesCash;
    const expectedCard = salesCard;
    const expectedUsd = salesUsd;

    const totalGeneralMxn =
      expectedCash + expectedCard + expectedUsd * exchangeRate;

    return {
      openingAmount,
      exchangeRate,
      salesCash,
      salesCard,
      salesUsd,
      totalVentas,
      expectedCash,
      expectedCard,
      expectedUsd,
      totalGeneralMxn,
    };
  }, [session, sales]);

  const declarados = useMemo(() => {
    const declaredCash = Number(cash || 0);
    const declaredCard = Number(card || 0);
    const declaredUsd = Number(usd || 0);

    return {
      declaredCash,
      declaredCard,
      declaredUsd,
      cashDifference: declaredCash - resumen.expectedCash,
      cardDifference: declaredCard - resumen.expectedCard,
      usdDifference: declaredUsd - resumen.expectedUsd,
      totalDeclaredMxn:
        declaredCash +
        declaredCard +
        declaredUsd * Number(resumen.exchangeRate || 1),
    };
  }, [cash, card, usd, resumen]);

  async function cerrar() {
    if (!storeId) {
      alert("No hay sucursal definida");
      return;
    }

    if (!session) {
      alert("No hay sesión abierta para esta sucursal");
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que deseas cerrar la caja de este turno?"
    );

    if (!confirmed) return;

    const { data, error } = await supabase.rpc(
      "close_cash_register_client",
      {
        p_store_id: storeId,
        p_user_name: user?.email || "Cajero",
        p_cash_declared: Number(cash || 0),
        p_card_declared: Number(card || 0),
        p_usd_declared: Number(usd || 0),
      }
    );

    if (error) {
      alert("Error al cerrar caja: " + error.message);
      return;
    }

    setStatus(data);
  }

  function money(value: number) {
    return `$${value.toFixed(2)}`;
  }

  function diffClass(value: number) {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-700";
  }

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">Cargando cierre de caja...</h2>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">No hay sucursal definida</h2>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">
          No hay caja abierta para esta sucursal
        </h2>
      </div>
    );
  }

  if (status === "NO_OPEN_CUT") {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">
          No hay caja abierta para este usuario
        </h2>
      </div>
    );
  }

  if (status === "OK") {
    return (
      <div className="p-6 max-w-3xl">
        <h2 className="text-lg font-bold mb-4">
          Caja cerrada correctamente
        </h2>

        <div className="border p-4 rounded space-y-2 bg-white">
          <p>
            <span className="font-semibold">Sesión:</span> {session.id}
          </p>
          <p>
            <span className="font-semibold">Apertura:</span>{" "}
            {new Date(session.opened_at).toLocaleString()}
          </p>
          <p>
            <span className="font-semibold">Monto inicial:</span>{" "}
            {money(resumen.openingAmount)}
          </p>
          <p>
            <span className="font-semibold">Tipo de cambio:</span>{" "}
            {Number(resumen.exchangeRate).toFixed(4)}
          </p>

          <div className="border-t pt-3 mt-3">
            <p className="font-semibold mb-2">Resumen esperado</p>
            <p>Efectivo esperado: {money(resumen.expectedCash)}</p>
            <p>Tarjeta esperada: {money(resumen.expectedCard)}</p>
            <p>USD esperados: {money(resumen.expectedUsd)}</p>
            <p>Total general (MXN): {money(resumen.totalGeneralMxn)}</p>
          </div>

          <div className="border-t pt-3 mt-3">
            <p className="font-semibold mb-2">Declarado por cajero</p>
            <p>Efectivo declarado: {money(Number(cash || 0))}</p>
            <p>Tarjeta declarada: {money(Number(card || 0))}</p>
            <p>USD declarados: {money(Number(usd || 0))}</p>
            <p>Total declarado (MXN): {money(declarados.totalDeclaredMxn)}</p>
          </div>

          <div className="border-t pt-3 mt-3">
            <p className="font-semibold mb-2">Diferencias</p>
            <p className={diffClass(declarados.cashDifference)}>
              Diferencia efectivo: {money(declarados.cashDifference)}
            </p>
            <p className={diffClass(declarados.cardDifference)}>
              Diferencia tarjeta: {money(declarados.cardDifference)}
            </p>
            <p className={diffClass(declarados.usdDifference)}>
              Diferencia USD: {money(declarados.usdDifference)}
            </p>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Este comprobante muestra el resumen esperado del turno y los importes
            declarados por el cajero al momento del cierre.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-lg font-bold mb-4">Cierre de Caja</h2>

      <div className="border rounded p-4 mb-6 bg-white space-y-2">
        <p>
          <span className="font-semibold">Sesión abierta:</span> {session.id}
        </p>
        <p>
          <span className="font-semibold">Fecha de apertura:</span>{" "}
          {new Date(session.opened_at).toLocaleString()}
        </p>
        <p>
          <span className="font-semibold">Monto inicial:</span>{" "}
          {money(resumen.openingAmount)}
        </p>
        <p>
          <span className="font-semibold">Tipo de cambio:</span>{" "}
          {Number(resumen.exchangeRate).toFixed(4)}
        </p>
        <p>
          <span className="font-semibold">Ventas del turno:</span>{" "}
          {sales.length}
        </p>
        <p>
          <span className="font-semibold">Total vendido:</span>{" "}
          {money(resumen.totalVentas)}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="border rounded p-4 bg-white">
          <h3 className="font-bold mb-3">Resumen esperado</h3>

          <div className="space-y-2">
            <p>Efectivo esperado: {money(resumen.expectedCash)}</p>
            <p>Tarjeta esperada: {money(resumen.expectedCard)}</p>
            <p>USD esperados: {money(resumen.expectedUsd)}</p>
            <p className="font-bold pt-2">
              Total general (MXN): {money(resumen.totalGeneralMxn)}
            </p>
          </div>
        </div>

        <div className="border rounded p-4 bg-white">
          <h3 className="font-bold mb-3">Importes declarados</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm">Efectivo contado</label>
              <input
                type="number"
                step="0.01"
                className="border p-2 w-full"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm">Tarjeta contada</label>
              <input
                type="number"
                step="0.01"
                className="border p-2 w-full"
                value={card}
                onChange={(e) => setCard(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm">USD contados</label>
              <input
                type="number"
                step="0.01"
                className="border p-2 w-full"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border rounded p-4 bg-white mb-6">
        <h3 className="font-bold mb-3">Diferencias</h3>

        <div className="space-y-2">
          <p className={diffClass(declarados.cashDifference)}>
            Diferencia efectivo: {money(declarados.cashDifference)}
          </p>
          <p className={diffClass(declarados.cardDifference)}>
            Diferencia tarjeta: {money(declarados.cardDifference)}
          </p>
          <p className={diffClass(declarados.usdDifference)}>
            Diferencia USD: {money(declarados.usdDifference)}
          </p>
          <p className="font-bold pt-2">
            Total declarado (MXN): {money(declarados.totalDeclaredMxn)}
          </p>
        </div>
      </div>

      <button
        className="bg-green-600 text-white px-4 py-2 w-full"
        onClick={cerrar}
      >
        Cerrar caja
      </button>
    </div>
  );
}