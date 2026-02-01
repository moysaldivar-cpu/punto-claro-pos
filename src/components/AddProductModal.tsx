import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddProductModal({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSave() {
    setError(null);

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError("Precio inválido");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("products").insert({
      name: name.trim(),
      price: numericPrice,
      sku: sku.trim() || null,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setPrice("");
    setSku("");
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">Agregar producto</h2>

        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm">Nombre</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">Precio</label>
          <input
            className="w-full border rounded px-3 py-2"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm">SKU (opcional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
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
