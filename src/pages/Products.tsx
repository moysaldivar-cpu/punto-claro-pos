import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import EditProductModal from "@/components/EditProductModal";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  active: boolean;
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, price, active")
      .order("name");

    if (error) {
      console.error("Error loading products:", error);
      setProducts([]);
    } else {
      setProducts(data ?? []);
    }

    setLoading(false);
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    // refresca lista
    loadProducts();
  }

  if (loading) {
    return <div>Cargando productos…</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Productos</h1>
        <button className="bg-black text-white px-4 py-2 rounded">
          Agregar producto
        </button>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">Nombre</th>
            <th className="p-2">SKU</th>
            <th className="p-2">Precio</th>
            <th className="p-2">Activo</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">
                No hay productos registrados
              </td>
            </tr>
          )}

          {products.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.name}</td>
              <td className="p-2">{p.sku ?? "-"}</td>
              <td className="p-2">${p.price.toFixed(2)}</td>
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={() => toggleActive(p)}
                />
              </td>
              <td className="p-2 space-x-3">
                <button
                  onClick={() => setEditingProduct(p)}
                  className="text-blue-600 underline text-sm"
                >
                  Editar
                </button>
                <button className="text-sm underline">
                  Asignar inventario
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EditProductModal
        open={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSaved={loadProducts}
      />
    </div>
  );
}
