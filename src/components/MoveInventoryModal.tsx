import { useEffect, useMemo, useState } from "react";

export type MoveMode = "in" | "out";

type Props = {
  open: boolean;
  mode: MoveMode; // "in" = entrada, "out" = salida
  productName?: string;
  currentStock?: number;
  onClose: () => void;
  onConfirm: (payload: { delta: number; reason: string }) => Promise<void> | void;
};

export default function MoveInventoryModal({
  open,
  mode,
  productName,
  currentStock,
  onClose,
  onConfirm,
}: Props) {
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "in" ? "Entrada de inventario" : "Salida de inventario";
  const sign = mode === "in" ? "+" : "−";

  const parsedQty = useMemo<number>(() => {
    const n = Number(quantity);
    return Number.isFinite(n) ? n : NaN;
  }, [quantity]);

  const canSubmit = useMemo<boolean>(() => {
    return (
      open &&
      Number.isFinite(parsedQty) &&
      parsedQty >= 1 &&
      reason.trim().length > 0 &&
      !submitting
    );
  }, [open, parsedQty, reason, submitting]);

  useEffect(() => {
    if (open) {
      setQuantity("");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm(): Promise<void> {
    setError(null);

    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      setError("La cantidad debe ser un número positivo (mínimo 1).");
      return;
    }

    if (!reason.trim()) {
      setError("El motivo es obligatorio.");
      return;
    }

    // El signo lo aplica el sistema según el modo
    const delta =
      mode === "in" ? Math.abs(parsedQty) : -Math.abs(parsedQty);

    try {
      setSubmitting(true);
      await onConfirm({ delta, reason: reason.trim() });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error al registrar el movimiento.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>

        {/* Contexto */}
        <div className="mb-4 rounded border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Producto</span>
            <span className="font-medium">{productName ?? "—"}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-gray-500">Stock actual</span>
            <span className="font-medium">
              {typeof currentStock === "number" ? currentStock : "—"}
            </span>
          </div>
        </div>

        {/* Cantidad */}
        <label className="mb-1 block text-sm font-medium">
          Cantidad ({sign})
        </label>
        <input
          type="number"
          min={1}
          step={1}
          className="mb-1 w-full rounded border px-3 py-2"
          placeholder="Ej. 5"
          value={quantity}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setQuantity(e.target.value)
          }
          disabled={submitting}
        />
        <p className="mb-3 text-xs text-gray-500">
          Escribe la cantidad <strong>sin signo</strong>. El sistema aplica{" "}
          <strong>{sign}</strong> automáticamente.
        </p>

        {/* Motivo */}
        <label className="mb-1 block text-sm font-medium">Motivo</label>
        <input
          type="text"
          className="mb-3 w-full rounded border px-3 py-2"
          placeholder="Ej. Compra, merma, devolución"
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setReason(e.target.value)
          }
          disabled={submitting}
        />

        {error && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2">
          <button
            className="rounded border px-4 py-2"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {submitting ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
