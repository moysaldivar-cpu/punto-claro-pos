import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
};

type Props = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditProductModal({
  open,
  product,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku ?? "");
      setPrice(product.price.toFixed(2));
      setError(null);
    }
  }, [product]);

  if (!open || !product) return null;

  async function handleSave() {
    // ✅ FIX CLAVE (TypeScript-safe)
    if (!product) return;

    setSaving(true);
    setError(null);

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Precio inválido");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({
        name: name.trim(),
        sku: sku.trim() === "" ? null : sku.trim(),
        price: parsedPrice,
      })
      .eq("id", product.id);

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
        <h3 className="text-lg font-semibold mb-4">Editar producto</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Nombre</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">SKU</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Precio</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded px-3 py-2"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
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
