import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";
import beerZoneLogo from "@/assets/beer-zone-logo.png";

type Sale = {
  id: string;
  created_at: string;
  store_id: string;
  cash_session_id: string | null;
  total: number;
  payment_method: string;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
  user_name: string;
};

type PaymentMethod = "cash" | "card" | "mixed";

type PaymentPayload = {
  payment_method: PaymentMethod;
  payment_cash: number;
  payment_usd: number;
  payment_card: number;
};

type SalesItemRow = {
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number | null;
};

type ProductInfo = {
  id: string;
  name: string;
};

type TicketLineItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  pricing_type: "regular" | "promo" | "night";
  promo_name?: string | null;
};

type TicketData = {
  sale: Sale;
  items: TicketLineItem[];
  payment: PaymentPayload;
  exchangeRate: number;
};

export default function SalesHistory() {
  const { user, loading } = usePosAuth();

  const role = ((user as any)?.rol ?? (user as any)?.role ?? null) as
    | "admin"
    | "gerente"
    | "cajero"
    | null;

  const isAdmin = role === "admin";

  const [salesLoading, setSalesLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [reprintLoadingId, setReprintLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (isAdmin) {
      loadSales();
      return;
    }

    setSalesLoading(false);
  }, [loading, isAdmin]);

  async function loadSales() {
    setSalesLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        created_at,
        store_id,
        cash_session_id,
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
      setSalesLoading(false);
      return;
    }

    setSales(
      (data || []).map((row: any) => ({
        id: String(row.id),
        created_at: String(row.created_at),
        store_id: String(row.store_id || ""),
        cash_session_id: row.cash_session_id ? String(row.cash_session_id) : null,
        total: Number(row.total || 0),
        payment_method: String(row.payment_method || "cash"),
        payment_cash: Number(row.payment_cash || 0),
        payment_card: Number(row.payment_card || 0),
        payment_usd: Number(row.payment_usd || 0),
        user_name: String(row.user_name || "Cajero"),
      }))
    );

    setSalesLoading(false);
  }

  function normalizePaymentMethod(method: string): PaymentMethod {
    if (method === "card") return "card";
    if (method === "mixed") return "mixed";
    return "cash";
  }

  async function handleReprintTicket(sale: Sale) {
    setReprintLoadingId(sale.id);

    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_items")
        .select("sale_id, product_id, quantity, unit_price, subtotal")
        .eq("sale_id", sale.id);

      if (itemsError || !itemsData) {
        alert("No se pudieron cargar los productos de esta venta.");
        return;
      }

      const saleItems = itemsData as SalesItemRow[];

      if (saleItems.length === 0) {
        alert("Esta venta no tiene productos registrados.");
        return;
      }

      const productIds = Array.from(
        new Set(saleItems.map((item) => String(item.product_id || "")))
      ).filter((id) => id.length > 0);

      const { data: productsData } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      const productMap = new Map<string, ProductInfo>(
        ((productsData || []) as any[]).map((product) => [
          String(product.id),
          {
            id: String(product.id),
            name: String(product.name || "Producto"),
          },
        ])
      );

      let exchangeRate = 1;

      if (sale.cash_session_id) {
        const { data: sessionData } = await supabase
          .from("cash_sessions")
          .select("exchange_rate")
          .eq("id", sale.cash_session_id)
          .maybeSingle();

        if (sessionData?.exchange_rate) {
          exchangeRate = Number(sessionData.exchange_rate || 1);
        }
      }

      const ticketItems: TicketLineItem[] = saleItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const subtotal =
          item.subtotal === null || item.subtotal === undefined
            ? Number((unitPrice * quantity).toFixed(2))
            : Number(item.subtotal || 0);

        const product = productMap.get(String(item.product_id || ""));

        return {
          product_id: String(item.product_id || ""),
          name: product?.name || "Producto",
          quantity,
          unit_price: unitPrice,
          subtotal,
          pricing_type: "regular",
          promo_name: null,
        };
      });

      setTicket({
        sale,
        items: ticketItems,
        payment: {
          payment_method: normalizePaymentMethod(sale.payment_method),
          payment_cash: Number(sale.payment_cash || 0),
          payment_card: Number(sale.payment_card || 0),
          payment_usd: Number(sale.payment_usd || 0),
        },
        exchangeRate,
      });
    } catch (err: any) {
      alert("Error al reimprimir ticket: " + (err.message || "Error desconocido"));
    } finally {
      setReprintLoadingId(null);
    }
  }

  if (loading || salesLoading) {
    return <div className="p-6">Cargando ventas…</div>;
  }

  if (!user || !isAdmin) {
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
      <h1 className="text-xl font-semibold mb-4">Historial de ventas</h1>

      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded mb-4 text-sm">
        Desde esta pantalla puedes consultar ventas anteriores y reimprimir el
        ticket sin modificar inventario, caja ni registros de venta.
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Usuario</th>
              <th className="p-2 text-center">Método</th>
              <th className="p-2 text-center">Total</th>
              <th className="p-2 text-center">Acción</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-b">
                <td className="p-2">
                  {new Date(sale.created_at).toLocaleString()}
                </td>

                <td className="p-2">{sale.user_name}</td>

                <td className="p-2 text-center">{sale.payment_method}</td>

                <td className="p-2 text-center font-semibold">
                  ${Number(sale.total || 0).toFixed(2)}
                </td>

                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleReprintTicket(sale)}
                    disabled={reprintLoadingId === sale.id}
                    className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                  >
                    {reprintLoadingId === sale.id
                      ? "Cargando..."
                      : "Reimprimir ticket"}
                  </button>
                </td>
              </tr>
            ))}

            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No hay ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-gray-500">
        La reimpresión solo vuelve a mostrar el comprobante de una venta ya
        registrada. No modifica inventario, caja ni reportes.
      </div>

      {ticket && (
        <TicketModal
          ticket={ticket}
          onClose={() => {
            setTicket(null);
          }}
        />
      )}
    </div>
  );
}

function TicketModal({
  ticket,
  onClose,
}: {
  ticket: TicketData;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrintShortcut =
        event.key === "F1" ||
        (event.ctrlKey && event.altKey && event.key.toLowerCase() === "i");

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

  const subtotalItems = ticket.items.reduce(
    (acc, item) => acc + Number(item.subtotal || 0),
    0
  );

  const totalPagado =
    Number(ticket.payment.payment_cash || 0) +
    Number(ticket.payment.payment_card || 0) +
    Number(ticket.payment.payment_usd || 0) * Number(ticket.exchangeRate || 1);

  const cambio = totalPagado - subtotalItems;

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
            <p className="text-xs text-gray-500 mt-1">REIMPRESIÓN DE TICKET</p>
          </div>

          <div className="mb-4 text-sm space-y-1">
            <div>
              <span className="font-semibold">Folio:</span>{" "}
              {ticket.sale?.id || "N/A"}
            </div>

            <div>
              <span className="font-semibold">Fecha:</span>{" "}
              {ticket.sale?.created_at
                ? new Date(ticket.sale.created_at).toLocaleString()
                : new Date().toLocaleString()}
            </div>

            <div>
              <span className="font-semibold">Cajero:</span>{" "}
              {ticket.sale?.user_name || "Cajero"}
            </div>
          </div>

          <div className="border-t border-b py-3 mb-4">
            {ticket.items.map((item, index) => (
              <div
                key={`${item.product_id}-${item.pricing_type}-${
                  item.promo_name || "base"
                }-${index}`}
                className="mb-2 text-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    {item.name} x{item.quantity}
                  </div>

                  <div>${Number(item.subtotal || 0).toFixed(2)}</div>
                </div>

                {item.pricing_type === "promo" && item.promo_name && (
                  <div className="text-xs text-green-700">
                    {item.promo_name}
                  </div>
                )}

                {item.pricing_type === "night" && (
                  <div className="text-xs text-amber-700">Precio nocturno</div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between">
              <span>Efectivo</span>
              <span>${Number(ticket.payment.payment_cash || 0).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Tarjeta</span>
              <span>${Number(ticket.payment.payment_card || 0).toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>USD</span>
              <span>${Number(ticket.payment.payment_usd || 0).toFixed(4)}</span>
            </div>

            <div className="flex justify-between">
              <span>Tipo de cambio</span>
              <span>{Number(ticket.exchangeRate || 1).toFixed(4)}</span>
            </div>

            <div className="flex justify-between font-bold text-base pt-2">
              <span>Total</span>
              <span>${subtotalItems.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Cambio</span>
              <span>${(cambio > 0 ? cambio : 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center text-xs mb-4">OPTICODE LABS</div>

          <div className="mb-4 text-center text-xs text-gray-700 leading-relaxed">
            El reembolso del importe de su compra es válido únicamente dentro de
            las primeras 24 horas posteriores a la fecha de compra.
          </div>

          <div className="mb-3 text-center text-xs text-gray-500">
            Atajo: F1 o Ctrl + Alt + I para imprimir
          </div>

          <div className="flex gap-2">
            <button
              className="bg-black text-white px-4 py-2 rounded w-full"
              onClick={() => window.print()}
            >
              Imprimir
            </button>

            <button className="border px-4 py-2 rounded w-full" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}