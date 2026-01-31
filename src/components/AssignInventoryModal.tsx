import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  productId: string | null;
  productName: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function AssignInventoryModal({
  open,
  productId,
  productName,
  onClose,
  onSaved,
}: Props) {
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !productId) return null;

  const storeId = localStorage.getItem("store_id");

  async function handleSave() {
    setError(null);

    const stockValue = Number(stock);
    const minStockValue = Number(minStock);

    if (!storeId) {
      setError("Sucursal no definida");
      return;
    }

    if (isNaN(stockValue) || stockValue < 0) {
      setError("Stock inválido");
      return;
    }

    if (isNaN(minStockValue) || minStockValue < 0) {
      setError("Stock mínimo inválido");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("inventory").insert({
      product_id: productId,
      store_id: storeId,
      stock: stockValue,
      min_stock: minStockValue,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setStock("");
    setMinStock("");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">
          Asignar inventario
        </h2>

        <p className="text-sm text-gray-600">
          Producto: <strong>{productName}</strong>
        </p>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm">Stock inicial</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Stock mínimo</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            className="px-4 py-2 text-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={loading}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
