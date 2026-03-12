import { useEffect, useState } from "react";

type PaymentMethod = "cash" | "card" | "mixed";

type Props = {
  open: boolean;
  total: number;
  exchangeRate: number;
  onClose: () => void;
  onConfirm: (payload: {
    payment_method: PaymentMethod;
    payment_cash: number;
    payment_card: number;
    payment_usd: number;
  }) => void;
};

export default function PaymentModal({
  open,
  total,
  exchangeRate,
  onClose,
  onConfirm,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cash, setCash] = useState<string>("");
  const [card, setCard] = useState<string>("");
  const [usd, setUsd] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setMethod("cash");
      setCash("");
      setCard("");
      setUsd("");
    }
  }, [open]);

  if (!open) return null;

  const cashValue = Number(cash) || 0;
  const cardValue = Number(card) || 0;
  const usdValue = Number(usd) || 0;

  const usdInMXN = usdValue * exchangeRate;

  const sum =
    method === "cash"
      ? cashValue + usdInMXN
      : method === "card"
      ? cardValue
      : cashValue + cardValue + usdInMXN;

  // 🔥 VALIDACIÓN CORRECTA
  const isValid =
    method === "card"
      ? Number(sum.toFixed(2)) === Number(total.toFixed(2))
      : Number(sum.toFixed(2)) >= Number(total.toFixed(2));

  // 🔥 CAMBIO CALCULADO
  const change =
    method === "card" ? 0 : Math.max(0, sum - total);

  const handleConfirm = () => {
    if (!isValid) return;

    onConfirm({
      payment_method: method,
      payment_cash: cashValue,
      payment_card: cardValue,
      payment_usd: usdValue,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          Cobro
        </h3>

        <div className="text-sm text-gray-500 mb-3">
          Tipo de cambio: {exchangeRate}
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMethod("cash")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "cash" ? "bg-black text-white" : "border"
            }`}
          >
            Efectivo / USD
          </button>

          <button
            onClick={() => setMethod("card")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "card" ? "bg-black text-white" : "border"
            }`}
          >
            Tarjeta
          </button>

          <button
            onClick={() => setMethod("mixed")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "mixed" ? "bg-black text-white" : "border"
            }`}
          >
            Mixto
          </button>
        </div>

        {(method === "cash" || method === "mixed") && (
          <>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">
                Efectivo (MXN)
              </label>
              <input
                type="number"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">
                USD
              </label>
              <input
                type="number"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
              />
              {usdValue > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Equivalente MXN: ${usdInMXN.toFixed(2)}
                </div>
              )}
            </div>
          </>
        )}

        {(method === "card" || method === "mixed") && (
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">
              Tarjeta (MXN)
            </label>
            <input
              type="number"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0.00"
            />
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Total: <span className="font-semibold">${total.toFixed(2)}</span>
        </div>

        {/* 🔥 CAMBIO */}
        {(method === "cash" || method === "mixed") && sum >= total && (
          <div className="mt-2 text-sm text-green-600">
            Cambio: ${change.toFixed(2)}
          </div>
        )}

        {!isValid && (
          <div className="mt-2 text-xs text-red-600">
            {method === "card"
              ? `La tarjeta debe cubrir exactamente ${total.toFixed(2)}`
              : `El pago debe ser al menos ${total.toFixed(2)}`}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border py-2"
          >
            Cancelar
          </button>

          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className={`flex-1 rounded-lg py-2 text-white ${
              isValid ? "bg-black" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}