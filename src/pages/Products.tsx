import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AddProductModal from "@/components/AddProductModal";
import AssignInventoryModal from "@/components/AssignInventoryModal";

type Product = {
  id: string;
  name: string;
  price: number;
  sku: string | null;
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [inventoryProduct, setInventoryProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, sku")
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setProducts(data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6">Cargando productos…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={() => setIsAddOpen(true)}
        >
          Agregar producto
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2">Nombre</th>
              <th className="text-left px-4 py-2">SKU</th>
              <th className="text-right px-4 py-2">Precio</th>
              <th className="text-center px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-6">
                  No hay productos registrados
                </td>
              </tr>
            )}

            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2 text-gray-500">
                  {p.sku ?? "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  ${p.price.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    className="text-sm underline"
                    onClick={() => setInventoryProduct(p)}
                  >
                    Asignar inventario
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      <AddProductModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSaved={loadProducts}
      />

      <AssignInventoryModal
        open={!!inventoryProduct}
        productId={inventoryProduct?.id ?? null}
        productName={inventoryProduct?.name ?? null}
        onClose={() => setInventoryProduct(null)}
        onSaved={() => {}}
      />
    </div>
  );
}
