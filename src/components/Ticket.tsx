import React from "react";

type TicketItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type TicketProps = {
  // Identidad
  folio: string;
  created_at: string; // ISO
  store_name?: string;

  // Cajero
  user_name: string;

  // Líneas
  items: TicketItem[];

  // Totales
  subtotal: number;
  tax: number;
  total: number;

  // Pago
  payment_method: "cash" | "card" | "mixed";
  payment_cash: number;
  payment_card: number;
  payment_usd: number;

  // Meta
  currency?: string; // default MXN
};

export default function Ticket({
  folio,
  created_at,
  store_name,
  user_name,
  items,
  subtotal,
  tax,
  total,
  payment_method,
  payment_cash,
  payment_card,
  payment_usd,
  currency = "MXN",
}: TicketProps) {
  const date = new Date(created_at);

  return (
    <div className="w-[280px] text-xs font-mono bg-white text-black p-3">
      {/* Header */}
      <div className="text-center mb-3">
        <div className="font-bold text-sm">
          {store_name ?? "Punto Claro"}
        </div>
        <div>Folio: {folio}</div>
        <div>
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      </div>

      {/* Cajero */}
      <div className="mb-2">
        <span className="font-semibold">Cajero:</span> {user_name}
      </div>

      {/* Items */}
      <div className="border-t border-b py-2 my-2">
        {items.map((it, idx) => (
          <div key={idx} className="mb-1">
            <div className="flex justify-between">
              <span>{it.product_name}</span>
              <span>
                {it.quantity} × {formatMoney(it.unit_price, currency)}
              </span>
            </div>
            <div className="text-right">
              {formatMoney(it.line_total, currency)}
            </div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="mb-2">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Impuesto</span>
          <span>{formatMoney(tax, currency)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
      </div>

      {/* Pago */}
      <div className="border-t pt-2">
        <div className="mb-1">
          <span className="font-semibold">Pago:</span>{" "}
          {labelPaymentMethod(payment_method)}
        </div>
        {payment_cash > 0 && (
          <div className="flex justify-between">
            <span>Efectivo</span>
            <span>{formatMoney(payment_cash, currency)}</span>
          </div>
        )}
        {payment_card > 0 && (
          <div className="flex justify-between">
            <span>Tarjeta</span>
            <span>{formatMoney(payment_card, currency)}</span>
          </div>
        )}
        {payment_usd > 0 && (
          <div className="flex justify-between">
            <span>USD</span>
            <span>{payment_usd.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center mt-3">
        <div>Gracias por su compra</div>
        <div className="mt-1">— Ticket v1 —</div>
      </div>
    </div>
  );
}

// Helpers (render-only)
function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function labelPaymentMethod(
  m: "cash" | "card" | "mixed"
) {
  if (m === "cash") return "Efectivo";
  if (m === "card") return "Tarjeta";
  return "Mixto";
}
