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

function parseMoneyInput(value: string) {
  if (!value) return 0;

  const normalized = value
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return parsed;
}

function normalizeMoneyText(value: string) {
  return value
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

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

  const safeExchangeRate = Number(exchangeRate || 1);

  const cashValue = parseMoneyInput(cash);
  const cardValue = parseMoneyInput(card);
  const usdValue = parseMoneyInput(usd);

  const usdInMXN = usdValue * safeExchangeRate;

  const sum =
    method === "cash"
      ? cashValue + usdInMXN
      : method === "card"
      ? cardValue
      : cashValue + cardValue + usdInMXN;

  const totalRounded = Number(total.toFixed(2));
  const sumRounded = Number(sum.toFixed(2));

  const isValid =
    method === "card"
      ? sumRounded === totalRounded
      : sumRounded >= totalRounded;

  const change = method === "card" ? 0 : Math.max(0, sum - total);

  const totalUsd = safeExchangeRate > 0 ? total / safeExchangeRate : 0;
  const paidMxn = sum;
  const remainingMxn = Math.max(0, total - paidMxn);
  const remainingUsd =
    safeExchangeRate > 0 ? remainingMxn / safeExchangeRate : 0;

  const handleConfirm = () => {
    if (!isValid) return;

    onConfirm({
      payment_method: method,
      payment_cash: cashValue,
      payment_card: cardValue,
      payment_usd: usdValue,
    });
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isF2 = event.key === "F2";
      const isCtrlEnter = event.ctrlKey && event.key === "Enter";

      if (isF2 || isCtrlEnter) {
        event.preventDefault();

        if (isValid) {
          handleConfirm();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isValid, method, cashValue, cardValue, usdValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Cobro</h3>

        <div className="rounded-lg border bg-gray-50 p-3 mb-4 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Total MXN</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>

          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Tipo de cambio</span>
            <span className="font-semibold">{safeExchangeRate.toFixed(4)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Total aproximado en USD</span>
            <span className="font-semibold">${totalUsd.toFixed(2)} USD</span>
          </div>
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
                type="text"
                inputMode="decimal"
                value={cash}
                onChange={(e) => setCash(normalizeMoneyText(e.target.value))}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">
                Dólar estadounidense
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={usd}
                onChange={(e) => setUsd(normalizeMoneyText(e.target.value))}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="0.00"
              />
              {usdValue > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {usdValue.toFixed(2)} USD × {safeExchangeRate.toFixed(4)} ={" "}
                  ${usdInMXN.toFixed(2)} MXN
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
              type="text"
              inputMode="decimal"
              value={card}
              onChange={(e) => setCard(normalizeMoneyText(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="0.00"
            />
          </div>
        )}

        <div className="mt-4 rounded-lg border p-3 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Capturado / pagado</span>
            <span className="font-semibold">${paidMxn.toFixed(2)} MXN</span>
          </div>

          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Faltante</span>
            <span
              className={`font-semibold ${
                remainingMxn > 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              ${remainingMxn.toFixed(2)} MXN
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Faltante aproximado en USD</span>
            <span
              className={`font-semibold ${
                remainingMxn > 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              ${remainingUsd.toFixed(2)} USD
            </span>
          </div>
        </div>

        {(method === "cash" || method === "mixed") && sum >= total && (
          <div className="mt-2 text-sm text-green-600">
            Cambio estimado: ${change.toFixed(2)} MXN
          </div>
        )}

        {!isValid && (
          <div className="mt-2 text-xs text-red-600">
            {method === "card"
              ? `La tarjeta debe cubrir exactamente $${total.toFixed(2)} MXN`
              : `El pago debe ser al menos $${total.toFixed(2)} MXN`}
          </div>
        )}

        <div className="mt-2 text-xs text-gray-500">
          Atajos: F2 o Ctrl + Enter para confirmar cobro
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border py-2">
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