import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";
import beerZoneLogo from "@/assets/beer-zone-logo.png";

type SaleStatus = "active" | "cancelled" | "partially_returned" | "fully_returned";

type Sale = {
  id: string;
  folio: string;
  created_at: string;
  store_id: string;
  cash_session_id: string | null;
  total: number;
  returned_total: number;
  status: SaleStatus;
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

type AdjustmentDetailRow = {
  sale_id: string;
  folio: string;
  sale_created_at: string;
  store_id: string;
  store_name: string;
  sale_status: SaleStatus;
  sale_total: number;
  returned_total: number;
  net_total: number;
  payment_method: string;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
  cashier: string;
  cash_session_id: string | null;
  sale_item_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity_sold: number;
  quantity_returned: number;
  quantity_available: number;
  unit_price: number;
  item_subtotal: number;
  effective_unit_price: number;
};

type TicketLineItem = {
  sale_item_id: string;
  product_id: string;
  name: string;
  quantity_sold: number;
  quantity_returned: number;
  quantity_net: number;
  unit_price: number;
  subtotal_original: number;
  subtotal_returned: number;
  subtotal_net: number;
};

type TicketData = {
  sale: Sale;
  items: TicketLineItem[];
  payment: PaymentPayload;
  exchangeRate: number;
  netTotal: number;
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

  function normalizePaymentMethod(method: string): PaymentMethod {
    if (method === "card") return "card";
    if (method === "mixed") return "mixed";
    return "cash";
  }

  function getNetTotal(sale: Sale) {
    if (sale.status === "cancelled" || sale.status === "fully_returned") {
      return 0;
    }

    return Math.max(Number(sale.total || 0) - Number(sale.returned_total || 0), 0);
  }

  function getStatusLabel(status: SaleStatus) {
    if (status === "cancelled") return "Cancelado";
    if (status === "partially_returned") return "Devolución parcial";
    if (status === "fully_returned") return "Devuelto completo";
    return "Activo";
  }

  function getStatusClass(status: SaleStatus) {
    if (status === "cancelled") {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (status === "partially_returned") {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === "fully_returned") {
      return "bg-purple-100 text-purple-700 border-purple-200";
    }

    return "bg-green-100 text-green-700 border-green-200";
  }

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  async function loadSales() {
    setSalesLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("sales")
      .select(`
        id,
        folio,
        created_at,
        store_id,
        cash_session_id,
        total,
        returned_total,
        status,
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
        folio: String(row.folio || ""),
        created_at: String(row.created_at),
        store_id: String(row.store_id || ""),
        cash_session_id: row.cash_session_id ? String(row.cash_session_id) : null,
        total: Number(row.total || 0),
        returned_total: Number(row.returned_total || 0),
        status: (row.status || "active") as SaleStatus,
        payment_method: String(row.payment_method || "cash"),
        payment_cash: Number(row.payment_cash || 0),
        payment_card: Number(row.payment_card || 0),
        payment_usd: Number(row.payment_usd || 0),
        user_name: String(row.user_name || "Cajero"),
      }))
    );

    setSalesLoading(false);
  }

  async function handleReprintTicket(sale: Sale) {
    setReprintLoadingId(sale.id);

    try {
      const { data: detailData, error: detailError } = await supabase.rpc(
        "get_sale_adjustment_detail",
        {
          p_sale_id: sale.id,
        }
      );

      if (detailError || !detailData) {
        alert("No se pudo cargar el detalle de esta venta.");
        return;
      }

      const detailRows = ((detailData || []) as any[]).map((row) => ({
        sale_id: String(row.sale_id || ""),
        folio: String(row.folio || sale.folio || ""),
        sale_created_at: String(row.sale_created_at || sale.created_at),
        store_id: String(row.store_id || sale.store_id || ""),
        store_name: String(row.store_name || "Sucursal"),
        sale_status: (row.sale_status || sale.status || "active") as SaleStatus,
        sale_total: Number(row.sale_total || sale.total || 0),
        returned_total: Number(row.returned_total || sale.returned_total || 0),
        net_total: Number(row.net_total ?? getNetTotal(sale)),
        payment_method: String(row.payment_method || sale.payment_method || "cash"),
        payment_cash: Number(row.payment_cash || sale.payment_cash || 0),
        payment_card: Number(row.payment_card || sale.payment_card || 0),
        payment_usd: Number(row.payment_usd || sale.payment_usd || 0),
        cashier: String(row.cashier || sale.user_name || "Cajero"),
        cash_session_id: row.cash_session_id
          ? String(row.cash_session_id)
          : sale.cash_session_id,
        sale_item_id: String(row.sale_item_id || ""),
        product_id: String(row.product_id || ""),
        product_name: String(row.product_name || "Producto").trim(),
        sku: row.sku ? String(row.sku) : null,
        quantity_sold: Number(row.quantity_sold || 0),
        quantity_returned: Number(row.quantity_returned || 0),
        quantity_available: Number(row.quantity_available || 0),
        unit_price: Number(row.unit_price || 0),
        item_subtotal: Number(row.item_subtotal || 0),
        effective_unit_price: Number(row.effective_unit_price || 0),
      })) as AdjustmentDetailRow[];

      if (detailRows.length === 0) {
        alert("Esta venta no tiene productos registrados.");
        return;
      }

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

      const firstRow = detailRows[0];

      const saleForTicket: Sale = {
        ...sale,
        folio: firstRow.folio || sale.folio,
        status: firstRow.sale_status || sale.status,
        total: Number(firstRow.sale_total || sale.total || 0),
        returned_total: Number(firstRow.returned_total || sale.returned_total || 0),
        payment_method: firstRow.payment_method || sale.payment_method,
        payment_cash: Number(firstRow.payment_cash || sale.payment_cash || 0),
        payment_card: Number(firstRow.payment_card || sale.payment_card || 0),
        payment_usd: Number(firstRow.payment_usd || sale.payment_usd || 0),
        user_name: firstRow.cashier || sale.user_name,
      };

      const ticketItems: TicketLineItem[] = detailRows.map((row) => {
        const quantitySold = Number(row.quantity_sold || 0);
        const quantityReturned = Number(row.quantity_returned || 0);
        const quantityNet = Math.max(quantitySold - quantityReturned, 0);

        const unitPrice = Number(row.effective_unit_price || row.unit_price || 0);
        const subtotalOriginal = Number(row.item_subtotal || 0);
        const subtotalReturned = Number((unitPrice * quantityReturned).toFixed(2));
        const subtotalNet = Number((unitPrice * quantityNet).toFixed(2));

        return {
          sale_item_id: row.sale_item_id,
          product_id: row.product_id,
          name: row.product_name || "Producto",
          quantity_sold: quantitySold,
          quantity_returned: quantityReturned,
          quantity_net: quantityNet,
          unit_price: unitPrice,
          subtotal_original: subtotalOriginal,
          subtotal_returned: subtotalReturned,
          subtotal_net: subtotalNet,
        };
      });

      setTicket({
        sale: saleForTicket,
        items: ticketItems,
        payment: {
          payment_method: normalizePaymentMethod(saleForTicket.payment_method),
          payment_cash: Number(saleForTicket.payment_cash || 0),
          payment_card: Number(saleForTicket.payment_card || 0),
          payment_usd: Number(saleForTicket.payment_usd || 0),
        },
        exchangeRate,
        netTotal: getNetTotal(saleForTicket),
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
        ticket sin modificar inventario, caja ni registros de venta. Los tickets
        cancelados y devueltos se muestran con su estado administrativo.
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2 text-left">Folio</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Usuario</th>
              <th className="p-2 text-center">Método</th>
              <th className="p-2 text-right">Original</th>
              <th className="p-2 text-right">Devuelto</th>
              <th className="p-2 text-right">Neto</th>
              <th className="p-2 text-center">Acción</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((sale) => {
              const netTotal = getNetTotal(sale);
              const isAdjusted =
                sale.status === "cancelled" ||
                sale.status === "partially_returned" ||
                sale.status === "fully_returned";

              return (
                <tr
                  key={sale.id}
                  className={`border-b ${
                    sale.status === "cancelled" || sale.status === "fully_returned"
                      ? "bg-gray-50 text-gray-500"
                      : ""
                  }`}
                >
                  <td className="p-2 font-semibold">{sale.folio}</td>

                  <td className="p-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusClass(
                        sale.status
                      )}`}
                    >
                      {getStatusLabel(sale.status)}
                    </span>
                  </td>

                  <td className="p-2">
                    {new Date(sale.created_at).toLocaleString()}
                  </td>

                  <td className="p-2">{sale.user_name}</td>

                  <td className="p-2 text-center capitalize">
                    {sale.payment_method}
                  </td>

                  <td
                    className={`p-2 text-right font-semibold ${
                      isAdjusted ? "line-through text-gray-400" : ""
                    }`}
                  >
                    {money(sale.total)}
                  </td>

                  <td className="p-2 text-right text-red-600">
                    {Number(sale.returned_total || 0) > 0
                      ? money(sale.returned_total)
                      : "-"}
                  </td>

                  <td className="p-2 text-right font-semibold">
                    {money(netTotal)}
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
              );
            })}

            {sales.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-500">
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

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function usd(value: number) {
    return `$${Number(value || 0).toFixed(4)}`;
  }

  function getStatusLabel(status: SaleStatus) {
    if (status === "cancelled") return "CANCELADO";
    if (status === "partially_returned") return "DEVOLUCIÓN PARCIAL";
    if (status === "fully_returned") return "DEVUELTO COMPLETO";
    return "ACTIVO";
  }

  const isAdjusted =
    ticket.sale.status === "cancelled" ||
    ticket.sale.status === "partially_returned" ||
    ticket.sale.status === "fully_returned";

  const totalPagadoOriginal =
    Number(ticket.payment.payment_cash || 0) +
    Number(ticket.payment.payment_card || 0) +
    Number(ticket.payment.payment_usd || 0) * Number(ticket.exchangeRate || 1);

  const cambioOriginal = totalPagadoOriginal - Number(ticket.sale.total || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 p-4 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center py-6">
        <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-full border bg-white px-3 py-1 text-sm font-semibold hover:bg-gray-50"
          >
            Cerrar
          </button>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <img
              src={beerZoneLogo}
              alt="Beer Zone marca de agua"
              className="w-64 opacity-5 object-contain"
            />
          </div>

          <div className="relative z-10 pt-5">
            <div className="text-center mb-3">
              <img
                src={beerZoneLogo}
                alt="Beer Zone"
                className="mx-auto h-16 object-contain mb-1"
              />
              <h2 className="text-2xl font-bold">BEER ZONE</h2>
              <p className="text-xs text-gray-500 mt-1">REIMPRESIÓN DE TICKET</p>

              {isAdjusted && (
                <div
                  className={`mt-3 rounded border px-3 py-2 text-sm font-bold ${
                    ticket.sale.status === "cancelled"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : ticket.sale.status === "partially_returned"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-purple-50 border-purple-200 text-purple-700"
                  }`}
                >
                  {getStatusLabel(ticket.sale.status)}
                </div>
              )}
            </div>

            <div className="mb-3 text-sm space-y-1">
              <div>
                <span className="font-semibold">Folio:</span>{" "}
                {ticket.sale.folio || "N/A"}
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

            <div className="border-t border-b py-3 mb-3">
              {ticket.items.map((item, index) => (
                <div
                  key={`${item.sale_item_id}-${item.product_id}-${index}`}
                  className="mb-2 text-sm"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <div>
                        {item.name} x{item.quantity_sold}
                      </div>

                      {item.quantity_returned > 0 && (
                        <div className="text-xs text-red-600">
                          Devuelto x{item.quantity_returned} · Neto x
                          {item.quantity_net}
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        item.quantity_returned > 0
                          ? "line-through text-gray-400"
                          : ""
                      }
                    >
                      {money(item.subtotal_original)}
                    </div>
                  </div>

                  {item.quantity_returned > 0 && (
                    <div className="flex justify-between text-xs text-gray-700 mt-1">
                      <span>Subtotal neto producto</span>
                      <span>{money(item.subtotal_net)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1 text-sm mb-3">
              <div className="flex justify-between">
                <span>Efectivo original</span>
                <span>{money(ticket.payment.payment_cash)}</span>
              </div>

              <div className="flex justify-between">
                <span>Tarjeta original</span>
                <span>{money(ticket.payment.payment_card)}</span>
              </div>

              <div className="flex justify-between">
                <span>USD original</span>
                <span>{usd(ticket.payment.payment_usd)}</span>
              </div>

              <div className="flex justify-between">
                <span>Tipo de cambio</span>
                <span>{Number(ticket.exchangeRate || 1).toFixed(4)}</span>
              </div>

              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total original</span>
                <span
                  className={
                    isAdjusted ? "line-through text-gray-400" : "font-bold"
                  }
                >
                  {money(ticket.sale.total)}
                </span>
              </div>

              {isAdjusted && (
                <>
                  <div className="flex justify-between text-red-600">
                    <span>Total devuelto/cancelado</span>
                    <span>{money(ticket.sale.returned_total)}</span>
                  </div>

                  <div className="flex justify-between font-bold text-base">
                    <span>Total neto</span>
                    <span>{money(ticket.netTotal)}</span>
                  </div>
                </>
              )}

              {!isAdjusted && (
                <div className="flex justify-between">
                  <span>Cambio</span>
                  <span>{money(cambioOriginal > 0 ? cambioOriginal : 0)}</span>
                </div>
              )}
            </div>

            <div className="text-center text-xs mb-3">OPTICODE LABS</div>

            <div className="mb-3 text-center text-xs text-gray-700 leading-relaxed">
              {isAdjusted
                ? "Ticket ajustado administrativamente. Conserve este comprobante para cualquier aclaración."
                : "El reembolso del importe de su compra es válido únicamente dentro de las primeras 24 horas posteriores a la fecha de compra."}
            </div>

            <div className="mb-3 text-center text-xs text-gray-500">
              Atajo: F1 o Ctrl + Alt + I para imprimir. También puedes cerrar con
              Escape.
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
    </div>
  );
}