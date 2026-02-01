import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  inventoryId: string;
  productId: string;
  storeId: string;
  currentStock: number;
  productName: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AdjustInventoryModal({
  open,
  inventoryId,
  productId,
  storeId,
  currentStock,
  productName,
  onClose,
  onSaved,
}: Props) {
  const [newStock, setNewStock] = useState<number>(currentStock);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    if (newStock < 0) {
      setError("El stock no puede ser negativo");
      return;
    }

    setSaving(true);
    setError(null);

    const { error } = await supabase.rpc("adjust_inventory", {
      p_inventory_id: inventoryId,
      p_product_id: productId,
      p_store_id: storeId,
      p_new_stock: newStock,
      p_reason: reason || null,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-2">
          Ajustar inventario
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Producto: <strong>{productName}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">
              Stock actual
            </label>
            <input
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={currentStock}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Nuevo stock
            </label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={newStock}
              onChange={(e) => setNewStock(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              Motivo (opcional)
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. ajuste por conteo físico"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
