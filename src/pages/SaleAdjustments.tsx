import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type SaleAdjustmentRow = {
  sale_id: string;
  folio: string | null;
  sale_created_at: string | null;
  store_id: string;
  store_name: string | null;
  sale_status: string;
  sale_total: number;
  returned_total: number;
  net_total: number;
  payment_method: string | null;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
  cashier: string | null;
  cash_session_id: string | null;

  sale_item_id: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  quantity_sold: number;
  quantity_returned: number;
  quantity_available: number;
  unit_price: number;
  item_subtotal: number;
  effective_unit_price: number;
};

type AdjustmentResult = {
  adjustment_id: string;
  adjusted_sale_id: string;
  new_status: string;
  total_refund_mxn: number;
  message: string;
};

function money(value: number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Activo";
    case "cancelled":
      return "Cancelado";
    case "partially_returned":
      return "Devolución parcial";
    case "fully_returned":
      return "Devuelto completo";
    default:
      return status || "Sin estado";
  }
}

function statusClass(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "partially_returned":
      return "bg-yellow-100 text-yellow-800";
    case "fully_returned":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export default function SaleAdjustments() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleAdjustmentRow[]>([]);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sale = rows[0] || null;

  const selectedItems = useMemo(() => {
    return rows
      .map((row) => {
        const rawQty = quantities[row.sale_item_id] || "";
        const qty = Number(rawQty);

        if (!Number.isFinite(qty) || qty <= 0) return null;

        const safeQty = Math.min(qty, row.quantity_available);
        const subtotal = Number((safeQty * row.effective_unit_price).toFixed(2));

        return {
          sale_item_id: row.sale_item_id,
          product_name: row.product_name || "Producto",
          quantity: safeQty,
          subtotal,
        };
      })
      .filter(Boolean) as {
      sale_item_id: string;
      product_name: string;
      quantity: number;
      subtotal: number;
    }[];
  }, [rows, quantities]);

  const partialRefundTotal = selectedItems.reduce(
    (acc, item) => acc + item.subtotal,
    0
  );

  async function findSaleIdBySearch() {
    const term = search.trim();

    if (!term) {
      alert("Ingresa un folio o ID de ticket.");
      return null;
    }

    if (isUuid(term)) {
      return term;
    }

    const { data, error } = await supabase
      .from("sales")
      .select("id, folio, created_at")
      .ilike("folio", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert("No se pudo buscar el ticket.");
      return null;
    }

    if (!data?.id) {
      alert("No se encontró ningún ticket con ese folio.");
      return null;
    }

    return data.id as string;
  }

  async function loadSaleDetail(forcedSaleId?: string) {
    try {
      setLoading(true);

      const idToLoad = forcedSaleId || (await findSaleIdBySearch());

      if (!idToLoad) return;

      const { data, error } = await supabase.rpc("get_sale_adjustment_detail", {
        p_sale_id: idToLoad,
      });

      if (error) {
        console.error(error);
        alert(error.message || "No se pudo cargar el detalle del ticket.");
        return;
      }

      const loadedRows = (data || []) as SaleAdjustmentRow[];

      if (loadedRows.length === 0) {
        alert("No se encontró detalle para este ticket.");
        setRows([]);
        setSaleId(null);
        return;
      }

      setSaleId(idToLoad);
      setRows(loadedRows);
      setQuantities({});
      setReason("");
    } finally {
      setLoading(false);
    }
  }

  function updateQuantity(row: SaleAdjustmentRow, value: string) {
    const cleanValue = value.replace(/[^\d]/g, "");

    if (!cleanValue) {
      setQuantities((prev) => ({
        ...prev,
        [row.sale_item_id]: "",
      }));
      return;
    }

    const numericValue = Number(cleanValue);
    const safeValue = Math.min(numericValue, row.quantity_available);

    setQuantities((prev) => ({
      ...prev,
      [row.sale_item_id]: String(safeValue),
    }));
  }

  async function cancelFullSale() {
    if (!saleId || !sale) return;

    if (sale.sale_status !== "active") {
      alert("Solo se puede cancelar completo un ticket activo.");
      return;
    }

    const cleanReason = reason.trim();

    if (!cleanReason) {
      alert("Escribe el motivo de la cancelación.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que quieres cancelar completo el ticket ${
        sale.folio || sale.sale_id
      }?\n\nEsta acción regresará todos los productos al inventario.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc("cancel_sale_full", {
        p_sale_id: saleId,
        p_admin_user_id: user?.id,
        p_reason: cleanReason,
      });

      if (error) {
        console.error(error);
        alert(error.message || "No se pudo cancelar el ticket.");
        return;
      }

      const result = (data?.[0] || null) as AdjustmentResult | null;

      alert(
        result?.message ||
          `Ticket cancelado correctamente. Total: ${money(sale.sale_total)}`
      );

      await loadSaleDetail(saleId);
    } finally {
      setSaving(false);
    }
  }

  async function returnPartialItems() {
    if (!saleId || !sale) return;

    if (sale.sale_status === "cancelled" || sale.sale_status === "fully_returned") {
      alert("Este ticket ya no permite devoluciones.");
      return;
    }

    const cleanReason = reason.trim();

    if (!cleanReason) {
      alert("Escribe el motivo de la devolución.");
      return;
    }

    if (selectedItems.length === 0) {
      alert("Selecciona al menos un producto para devolver.");
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que quieres registrar esta devolución parcial?\n\nTotal a devolver: ${money(
        partialRefundTotal
      )}\n\nEsta acción regresará los productos seleccionados al inventario.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);

      const payload = selectedItems.map((item) => ({
        sale_item_id: item.sale_item_id,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.rpc("return_sale_items", {
        p_sale_id: saleId,
        p_admin_user_id: user?.id,
        p_reason: cleanReason,
        p_items: payload,
      });

      if (error) {
        console.error(error);
        alert(error.message || "No se pudo registrar la devolución.");
        return;
      }

      const result = (data?.[0] || null) as AdjustmentResult | null;

      alert(
        result?.message ||
          `Devolución registrada correctamente. Total: ${money(
            partialRefundTotal
          )}`
      );

      await loadSaleDetail(saleId);
    } finally {
      setSaving(false);
    }
  }

  if (user?.rol !== "admin") {
    return (
      <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-xl font-bold text-red-600 mb-2">
          Acceso restringido
        </h1>
        <p className="text-gray-600">
          Este módulo solo está disponible para administración.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Cancelaciones y devoluciones
        </h1>
        <p className="text-sm text-gray-500">
          Módulo administrativo para cancelar tickets completos o registrar
          devoluciones parciales por producto.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Buscar ticket
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej. 202D-000091 o ID del ticket"
              className="border rounded px-3 py-2 w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  loadSaleDetail();
                }
              }}
            />
            <button
              type="button"
              onClick={() => loadSaleDetail()}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded font-semibold"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </div>

      {sale && (
        <>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold">
                    Ticket {sale.folio || sale.sale_id}
                  </h2>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${statusClass(
                      sale.sale_status
                    )}`}
                  >
                    {statusLabel(sale.sale_status)}
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-semibold">Sucursal:</span>{" "}
                    {sale.store_name || "Sin sucursal"}
                  </p>
                  <p>
                    <span className="font-semibold">Cajero:</span>{" "}
                    {sale.cashier || "Sin cajero"}
                  </p>
                  <p>
                    <span className="font-semibold">Fecha:</span>{" "}
                    {sale.sale_created_at
                      ? new Date(sale.sale_created_at).toLocaleString()
                      : "Sin fecha"}
                  </p>
                  <p>
                    <span className="font-semibold">Pago:</span>{" "}
                    {sale.payment_method || "Sin método"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Total original</p>
                  <p className="text-lg font-bold">{money(sale.sale_total)}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Devuelto</p>
                  <p className="text-lg font-bold">
                    {money(sale.returned_total)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Neto</p>
                  <p className="text-lg font-bold">{money(sale.net_total)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-900">Productos del ticket</h3>
              <p className="text-sm text-gray-500">
                Captura la cantidad solo en los productos que se van a devolver.
              </p>
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left p-3">Producto</th>
                    <th className="text-center p-3">Vendidas</th>
                    <th className="text-center p-3">Ya devueltas</th>
                    <th className="text-center p-3">Disponibles</th>
                    <th className="text-right p-3">Precio</th>
                    <th className="text-right p-3">Subtotal</th>
                    <th className="text-center p-3">Devolver</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.sale_item_id} className="border-t">
                      <td className="p-3">
                        <p className="font-semibold">
                          {row.product_name || "Producto"}
                        </p>
                        <p className="text-xs text-gray-500">
                          SKU: {row.sku || "Sin SKU"}
                        </p>
                      </td>
                      <td className="p-3 text-center">{row.quantity_sold}</td>
                      <td className="p-3 text-center">
                        {row.quantity_returned}
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {row.quantity_available}
                      </td>
                      <td className="p-3 text-right">
                        {money(row.effective_unit_price)}
                      </td>
                      <td className="p-3 text-right">
                        {money(row.item_subtotal)}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          value={quantities[row.sale_item_id] || ""}
                          onChange={(e) => updateQuantity(row, e.target.value)}
                          disabled={row.quantity_available <= 0}
                          inputMode="numeric"
                          className="border rounded px-2 py-1 w-20 text-center disabled:bg-gray-100"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y">
              {rows.map((row) => (
                <div key={row.sale_item_id} className="p-4 space-y-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      {row.product_name || "Producto"}
                    </p>
                    <p className="text-xs text-gray-500">
                      SKU: {row.sku || "Sin SKU"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Vendidas</p>
                      <p className="font-bold">{row.quantity_sold}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Ya devueltas</p>
                      <p className="font-bold">{row.quantity_returned}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Disponibles</p>
                      <p className="font-bold">{row.quantity_available}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Precio</p>
                      <p className="font-bold">
                        {money(row.effective_unit_price)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Cantidad a devolver
                    </label>
                    <input
                      value={quantities[row.sale_item_id] || ""}
                      onChange={(e) => updateQuantity(row, e.target.value)}
                      disabled={row.quantity_available <= 0}
                      inputMode="numeric"
                      className="border rounded px-3 py-2 w-full disabled:bg-gray-100"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Motivo obligatorio
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="border rounded px-3 py-2 w-full min-h-[90px]"
                placeholder="Ej. Cliente devolvió producto, error de captura, cancelación autorizada por administración..."
              />
            </div>

            {selectedItems.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <p className="font-bold text-yellow-900 mb-2">
                  Resumen devolución parcial
                </p>
                <ul className="space-y-1 text-yellow-900">
                  {selectedItems.map((item) => (
                    <li key={item.sale_item_id}>
                      {item.product_name}: {item.quantity} pza(s) —{" "}
                      {money(item.subtotal)}
                    </li>
                  ))}
                </ul>
                <p className="font-bold mt-2">
                  Total a devolver: {money(partialRefundTotal)}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={returnPartialItems}
                disabled={saving || selectedItems.length === 0}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-200 text-white px-4 py-2 rounded font-semibold"
              >
                {saving ? "Procesando..." : "Registrar devolución parcial"}
              </button>

              <button
                type="button"
                onClick={cancelFullSale}
                disabled={saving || sale.sale_status !== "active"}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded font-semibold"
              >
                {saving ? "Procesando..." : "Cancelar ticket completo"}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Las cancelaciones y devoluciones quedan registradas con usuario,
              fecha, hora y motivo. Los productos regresan al inventario
              automáticamente.
            </p>
          </div>
        </>
      )}
    </div>
  );
}