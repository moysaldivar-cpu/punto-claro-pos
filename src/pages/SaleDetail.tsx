import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import beerZoneLogo from "@/assets/beer-zone-logo.png";

type SaleStatus = "active" | "cancelled" | "partially_returned" | "fully_returned";

type Sale = {
  id: string;
  folio: string;
  created_at: string;
  store_name: string;
  user_name: string;
  payment_method: string;
  total: number;
  returned_total: number;
  net_total: number;
  status: SaleStatus;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
};

type Item = {
  sale_item_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity_sold: number;
  quantity_returned: number;
  quantity_net: number;
  unit_price: number;
  subtotal_original: number;
  subtotal_returned: number;
  subtotal_net: number;
};

type DetailRow = {
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

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;

    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc("get_sale_adjustment_detail", {
      p_sale_id: id,
    });

    if (error) {
      console.error(error);
      setSale(null);
      setItems([]);
      setError("No se pudo cargar el detalle de la venta.");
      setLoading(false);
      return;
    }

    const rows = ((data || []) as any[]).map((row) => ({
      sale_id: String(row.sale_id || ""),
      folio: String(row.folio || ""),
      sale_created_at: String(row.sale_created_at || ""),
      store_id: String(row.store_id || ""),
      store_name: String(row.store_name || "Sucursal"),
      sale_status: (row.sale_status || "active") as SaleStatus,
      sale_total: Number(row.sale_total || 0),
      returned_total: Number(row.returned_total || 0),
      net_total: Number(row.net_total || 0),
      payment_method: String(row.payment_method || "cash"),
      payment_cash: Number(row.payment_cash || 0),
      payment_card: Number(row.payment_card || 0),
      payment_usd: Number(row.payment_usd || 0),
      cashier: String(row.cashier || "Cajero"),
      cash_session_id: row.cash_session_id ? String(row.cash_session_id) : null,
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
    })) as DetailRow[];

    if (rows.length === 0) {
      setSale(null);
      setItems([]);
      setError("No se encontró información para esta venta.");
      setLoading(false);
      return;
    }

    const firstRow = rows[0];

    setSale({
      id: firstRow.sale_id,
      folio: firstRow.folio,
      created_at: firstRow.sale_created_at,
      store_name: firstRow.store_name,
      user_name: firstRow.cashier,
      payment_method: firstRow.payment_method,
      total: Number(firstRow.sale_total || 0),
      returned_total: Number(firstRow.returned_total || 0),
      net_total: Number(firstRow.net_total || 0),
      status: firstRow.sale_status || "active",
      payment_cash: Number(firstRow.payment_cash || 0),
      payment_card: Number(firstRow.payment_card || 0),
      payment_usd: Number(firstRow.payment_usd || 0),
    });

    const mappedItems: Item[] = rows.map((row) => {
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
        product_name: row.product_name || "Producto",
        sku: row.sku,
        quantity_sold: quantitySold,
        quantity_returned: quantityReturned,
        quantity_net: quantityNet,
        unit_price: unitPrice,
        subtotal_original: subtotalOriginal,
        subtotal_returned: subtotalReturned,
        subtotal_net: subtotalNet,
      };
    });

    setItems(mappedItems);
    setLoading(false);
  }

  function imprimir() {
    window.print();
  }

  function money(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function usd(value: number) {
    return `$${Number(value || 0).toFixed(4)}`;
  }

  function getStatusLabel(status: SaleStatus) {
    if (status === "cancelled") return "Cancelado";
    if (status === "partially_returned") return "Devolución parcial";
    if (status === "fully_returned") return "Devuelto completo";
    return "Activo";
  }

  function getStatusPrintLabel(status: SaleStatus) {
    if (status === "cancelled") return "CANCELADO";
    if (status === "partially_returned") return "DEVOLUCIÓN PARCIAL";
    if (status === "fully_returned") return "DEVUELTO COMPLETO";
    return "ACTIVO";
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

  function getPaymentLabel(method: string) {
    if (method === "cash") return "Efectivo";
    if (method === "card") return "Tarjeta";
    if (method === "mixed") return "Mixto";
    return method || "Sin método";
  }

  if (loading) {
    return <p className="p-6 text-gray-500">Cargando ticket...</p>;
  }

  if (error) {
    return <p className="p-6 text-red-600 font-semibold">{error}</p>;
  }

  if (!sale) {
    return <p className="p-6 text-gray-500">No encontrado</p>;
  }

  const isAdjusted =
    sale.status === "cancelled" ||
    sale.status === "partially_returned" ||
    sale.status === "fully_returned";

  const displayFolio =
    String(sale.folio || "").trim() ||
    String(sale.id || "")
      .replace(/-/g, "")
      .slice(0, 8)
      .toUpperCase() ||
    "N/A";

  return (
    <>
      <style>{`
        .sale-detail-print {
          display: none;
        }

        @media print {
          @page {
            size: 58mm auto;
            margin: 0;
          }

          html,
          body {
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .sale-detail-print,
          .sale-detail-print * {
            visibility: visible !important;
          }

          .sale-detail-print {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .sale-detail-print-paper {
            box-sizing: border-box !important;
            width: 58mm !important;
            max-width: 58mm !important;
            min-width: 58mm !important;
            margin: 0 !important;
            padding: 3mm 2.5mm !important;
            color: black !important;
            background: white !important;
            font-family: Arial, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.3 !important;
          }

          .sale-detail-print-paper img {
            max-width: 100% !important;
          }

          .sale-detail-print-item {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .sale-detail-refund-notice {
            border: 1px solid black !important;
            padding: 2mm !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            font-weight: 700 !important;
            text-align: center !important;
          }
        }
      `}</style>

      <div className="sale-detail-screen max-w-2xl mx-auto bg-white shadow rounded p-6 print:shadow-none print:p-0">
      <div className="text-center border-b pb-3 mb-3">
        <h2 className="text-xl font-bold">PUNTO CLARO</h2>
        <p className="text-sm text-gray-500">Detalle de venta</p>

        <div className="mt-3 print:hidden">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${getStatusClass(
              sale.status
            )}`}
          >
            {getStatusLabel(sale.status)}
          </span>
        </div>

        {isAdjusted && (
          <div
            className={`hidden print:block mt-3 rounded border px-3 py-2 text-sm font-bold ${
              sale.status === "cancelled"
                ? "bg-red-50 border-red-200 text-red-700"
                : sale.status === "partially_returned"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-purple-50 border-purple-200 text-purple-700"
            }`}
          >
            {getStatusPrintLabel(sale.status)}
          </div>
        )}
      </div>

      <div className="text-sm mb-4 space-y-1">
        <p>
          <strong>Folio:</strong> {sale.folio}
        </p>
        <p>
          <strong>Fecha:</strong>{" "}
          {sale.created_at
            ? new Date(sale.created_at).toLocaleString()
            : "Sin fecha"}
        </p>
        <p>
          <strong>Sucursal:</strong> {sale.store_name}
        </p>
        <p>
          <strong>Cajero:</strong> {sale.user_name}
        </p>
        <p>
          <strong>Método:</strong> {getPaymentLabel(sale.payment_method)}
        </p>
        <p className="print:hidden">
          <strong>Estado:</strong> {getStatusLabel(sale.status)}
        </p>
      </div>

      {isAdjusted && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded mb-4 text-sm print:bg-white print:text-black">
          Esta venta tuvo un ajuste administrativo. La venta original se conserva
          para auditoría y los importes netos ya descuentan cancelaciones o
          devoluciones.
        </div>
      )}

      <table className="w-full text-sm mb-4">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Producto</th>
            <th className="text-center py-2">Vend.</th>
            <th className="text-center py-2">Dev.</th>
            <th className="text-center py-2">Neto</th>
            <th className="text-right py-2">Precio</th>
            <th className="text-right py-2">Subtotal</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.sale_item_id} className="border-b">
              <td className="py-2">
                <div>{item.product_name}</div>
                {item.sku && (
                  <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                )}
                {item.quantity_returned > 0 && (
                  <div className="text-xs text-red-600">
                    Devuelto x{item.quantity_returned} · Neto x
                    {item.quantity_net}
                  </div>
                )}
              </td>

              <td className="text-center py-2">{item.quantity_sold}</td>

              <td className="text-center py-2 text-red-600">
                {item.quantity_returned > 0 ? item.quantity_returned : "-"}
              </td>

              <td className="text-center py-2 font-semibold">
                {item.quantity_net}
              </td>

              <td className="text-right py-2">{money(item.unit_price)}</td>

              <td className="text-right py-2">
                <div
                  className={
                    item.quantity_returned > 0
                      ? "line-through text-gray-400"
                      : "font-semibold"
                  }
                >
                  {money(item.subtotal_original)}
                </div>

                {item.quantity_returned > 0 && (
                  <div className="text-xs text-gray-700">
                    Neto: {money(item.subtotal_net)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-right space-y-1 text-sm border-t pt-2">
        <p>
          Total original:{" "}
          <span className={isAdjusted ? "line-through text-gray-400" : ""}>
            {money(sale.total)}
          </span>
        </p>

        {isAdjusted && (
          <p className="text-red-600">
            Total devuelto/cancelado: {money(sale.returned_total)}
          </p>
        )}

        <p className="font-bold text-base">
          Total neto: {money(sale.net_total)}
        </p>
      </div>

      <div className="mt-3 text-sm border-t pt-2">
        <p className="font-semibold mb-1">Pagos originales:</p>

        {sale.payment_cash > 0 ? (
          <p>Efectivo: {money(sale.payment_cash)}</p>
        ) : null}

        {sale.payment_card > 0 ? (
          <p>Tarjeta: {money(sale.payment_card)}</p>
        ) : null}

        {sale.payment_usd > 0 ? (
          <p>USD: {usd(sale.payment_usd)}</p>
        ) : null}

        {sale.payment_cash <= 0 &&
          sale.payment_card <= 0 &&
          sale.payment_usd <= 0 && <p>Sin pagos registrados.</p>}
      </div>

      <div className="text-center text-xs text-gray-500 mt-4 border-t pt-3">
        {isAdjusted ? (
          <p>
            Ticket ajustado administrativamente. Conserve este comprobante para
            cualquier aclaración.
          </p>
        ) : (
          <>
            <p>Gracias por su compra</p>
            <p>Conserve este ticket</p>
          </>
        )}
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="border px-3 py-2 rounded w-full"
        >
          Volver
        </button>

        <button
          onClick={imprimir}
          className="bg-gray-900 text-white px-3 py-2 rounded w-full"
        >
          Imprimir ticket
        </button>
      </div>
    </div>

      <div className="sale-detail-print">
        <div className="sale-detail-print-paper">
          <div className="text-center mb-3">
            <img
              src={beerZoneLogo}
              alt="Beer Zone"
              className="mx-auto h-16 object-contain mb-1"
            />
            <div className="text-xl font-bold">BEER ZONE</div>
            <div className="text-xs font-semibold">REIMPRESIÓN DE VENTA</div>
          </div>

          {isAdjusted && (
            <div className="border border-black text-center font-bold py-1 px-2 mb-3">
              {getStatusPrintLabel(sale.status)}
            </div>
          )}

          <div className="text-xs space-y-1 mb-3">
            <div>
              <span className="font-semibold">Folio:</span> {displayFolio}
            </div>

            <div>
              <span className="font-semibold">Fecha:</span>{" "}
              {sale.created_at
                ? new Date(sale.created_at).toLocaleString()
                : "Sin fecha"}
            </div>

            <div>
              <span className="font-semibold">Sucursal:</span>{" "}
              {sale.store_name}
            </div>

            <div>
              <span className="font-semibold">Cajero:</span>{" "}
              {sale.user_name}
            </div>

            <div>
              <span className="font-semibold">Método:</span>{" "}
              {getPaymentLabel(sale.payment_method)}
            </div>
          </div>

          <div className="border-t border-black pt-2">
            {items.map((item) => (
              <div
                key={item.sale_item_id}
                className="sale-detail-print-item border-b border-black py-2"
              >
                <div className="font-semibold">{item.product_name}</div>

                {item.sku && (
                  <div className="text-xs">SKU: {item.sku}</div>
                )}

                <div className="flex justify-between gap-2 mt-1">
                  <span>
                    {item.quantity_net} x {money(item.unit_price)}
                  </span>

                  <span className="font-semibold">
                    {money(item.subtotal_net)}
                  </span>
                </div>

                {item.quantity_returned > 0 && (
                  <div className="text-xs mt-1">
                    Vendido: {item.quantity_sold} · Devuelto:{" "}
                    {item.quantity_returned} · Neto: {item.quantity_net}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-b border-black py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Total original</span>
              <span>{money(sale.total)}</span>
            </div>

            {isAdjusted && (
              <div className="flex justify-between">
                <span>Devuelto/cancelado</span>
                <span>{money(sale.returned_total)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold">
              <span>Total neto</span>
              <span>{money(sale.net_total)}</span>
            </div>
          </div>

          <div className="border-b border-black py-2 text-xs space-y-1">
            <div className="font-semibold">Pagos originales</div>

            {sale.payment_cash > 0 && (
              <div className="flex justify-between">
                <span>Efectivo</span>
                <span>{money(sale.payment_cash)}</span>
              </div>
            )}

            {sale.payment_card > 0 && (
              <div className="flex justify-between">
                <span>Tarjeta</span>
                <span>{money(sale.payment_card)}</span>
              </div>
            )}

            {sale.payment_usd > 0 && (
              <div className="flex justify-between">
                <span>USD</span>
                <span>{usd(sale.payment_usd)}</span>
              </div>
            )}

            {sale.payment_cash <= 0 &&
              sale.payment_card <= 0 &&
              sale.payment_usd <= 0 && <div>Sin pagos registrados.</div>}
          </div>

          {isAdjusted && (
            <div className="text-center text-xs font-semibold py-2">
              Ticket ajustado administrativamente. Los importes mostrados
              reflejan las cancelaciones o devoluciones registradas.
            </div>
          )}

          <div className="sale-detail-refund-notice mt-2">
            El reembolso del importe de su compra es válido únicamente dentro
            de las primeras 24 horas posteriores a la fecha de compra.
          </div>

          <div className="text-center text-xs mt-3">
            <div>Gracias por su compra</div>
            <div>OPTICODE LABS</div>
          </div>
        </div>
      </div>
    </>
  );
}