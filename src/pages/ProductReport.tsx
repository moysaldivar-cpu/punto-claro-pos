import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function ProductReport() {
  const { user } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    if (!user) return;

    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", user.store_id)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setProducts(data || []);
  }

  async function loadHistory(productId: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales_items")
      .select(`
        quantity,
        unit_price,
        subtotal,
        sales (
          created_at
        )
      `)
      .eq("product_id", productId);

    if (error) {
      console.error(error);
      setHistory([]);
      setLoading(false);
      return;
    }

    setHistory(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

  function selectProduct(p: any) {
    setSelected(p);
    loadHistory(p.id);
  }

  return (
    <div className="bg-white rounded shadow mt-6">

      <h2 className="text-lg font-bold p-4 border-b">
        Análisis por Producto
      </h2>

      <div className="grid grid-cols-2">

        {/* LISTA PRODUCTOS */}

        <div className="border-r max-h-[400px] overflow-auto">

          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => selectProduct(p)}
              className={`p-3 cursor-pointer hover:bg-gray-100 ${
                selected?.id === p.id ? "bg-gray-200" : ""
              }`}
            >
              {p.name}
            </div>
          ))}

        </div>

        {/* HISTORIAL */}

        <div className="p-4">

          {!selected && (
            <p className="text-gray-500">
              Selecciona un producto para ver su historial
            </p>
          )}

          {selected && (
            <>
              <h3 className="font-bold mb-3">
                {selected.name}
              </h3>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Cantidad</th>
                    <th className="p-2">Precio</th>
                    <th className="p-2">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        {new Date(h.sales.created_at).toLocaleString()}
                      </td>
                      <td className="p-2">{h.quantity}</td>
                      <td className="p-2">${h.unit_price}</td>
                      <td className="p-2">${h.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {loading && <p className="mt-2">Cargando...</p>}
            </>
          )}

        </div>

      </div>

    </div>
  );
}