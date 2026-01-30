import { useEffect, useState } from "react";

type PaymentMethod = "cash" | "card" | "mixed";

type Props = {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (payload: {
    payment_method: PaymentMethod;
    payment_cash: number;
    payment_card: number;
  }) => void;
};

export default function PaymentModal({
  open,
  total,
  onClose,
  onConfirm,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cash, setCash] = useState<string>("");
  const [card, setCard] = useState<string>("");

  useEffect(() => {
    if (!open) {
      setMethod("cash");
      setCash("");
      setCard("");
    }
  }, [open]);

  if (!open) return null;

  const cashValue = Number(cash) || 0;
  const cardValue = Number(card) || 0;

  const sum =
    method === "cash"
      ? cashValue
      : method === "card"
      ? cardValue
      : cashValue + cardValue;

  const isValid = sum === total;

  const handleConfirm = () => {
    if (!isValid) return;

    onConfirm({
      payment_method: method,
      payment_cash: method === "card" ? 0 : cashValue,
      payment_card: method === "cash" ? 0 : cardValue,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Cobro</h3>

        {/* MÉTODO */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMethod("cash")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "cash"
                ? "bg-black text-white"
                : "border bg-white"
            }`}
          >
            Efectivo
          </button>

          <button
            onClick={() => setMethod("card")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "card"
                ? "bg-black text-white"
                : "border bg-white"
            }`}
          >
            Tarjeta
          </button>

          <button
            onClick={() => setMethod("mixed")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              method === "mixed"
                ? "bg-black text-white"
                : "border bg-white"
            }`}
          >
            Mixto
          </button>
        </div>

        {/* CAMPOS */}
        {(method === "cash" || method === "mixed") && (
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">
              Efectivo
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0.00"
            />
          </div>
        )}

        {(method === "card" || method === "mixed") && (
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">
              Tarjeta
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0.00"
            />
          </div>
        )}

        {/* TOTAL */}
        <div className="mt-4 text-sm text-gray-600">
          Total: <span className="font-semibold">${total.toFixed(2)}</span>
        </div>

        {!isValid && (
          <div className="mt-2 text-xs text-red-600">
            La suma debe ser exactamente ${total.toFixed(2)}
          </div>
        )}

        {/* ACCIONES */}
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
              isValid
                ? "bg-black hover:bg-gray-900"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
