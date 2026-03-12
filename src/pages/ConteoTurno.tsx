import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";

type Product = {
  id: string;
  name: string;
};

type InventoryCount = {
  product_id: string;
  fridge_qty: number;
  warehouse_qty: number;
};

export default function ConteoTurno() {
  const { user } = usePosAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { fridge: number; warehouse: number }>
  >({});
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user?.store_id) return;

      setLoading(true);

      // 1️⃣ Obtener sesión abierta
      const { data: sessionData } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("store_id", user.store_id)
        .eq("status", "open")
        .maybeSingle();

      if (!sessionData) {
        setLoading(false);
        return;
      }

      setCashSessionId(sessionData.id);

      // 2️⃣ Productos
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", user.store_id)
        .order("name", { ascending: true });

      setProducts(productsData || []);

      // 3️⃣ Conteos existentes
      const { data: countsData } = await supabase
        .from("inventory_counts")
        .select("product_id, fridge_qty, warehouse_qty")
        .eq("cash_session_id", sessionData.id);

      const countsMap: Record<
        string,
        { fridge: number; warehouse: number }
      > = {};

      countsData?.forEach((c: InventoryCount) => {
        countsMap[c.product_id] = {
          fridge: c.fridge_qty,
          warehouse: c.warehouse_qty,
        };
      });

      setCounts(countsMap);
      setLoading(false);
    }

    loadData();
  }, [user]);

  async function saveCount(productId: string) {
    if (!cashSessionId || !user?.store_id) return;

    const productCount = counts[productId] || {
      fridge: 0,
      warehouse: 0,
    };

    setSavingProductId(productId);

    const { error } = await supabase.from("inventory_counts").upsert(
      {
        store_id: user.store_id,
        cash_session_id: cashSessionId,
        product_id: productId,
        fridge_qty: productCount.fridge,
        warehouse_qty: productCount.warehouse,
        created_by: user.id,
      },
      {
        onConflict: "cash_session_id,product_id",
      }
    );

    setSavingProductId(null);

    if (error) {
      console.error(error);
      alert("Error al guardar conteo");
    }
  }

  if (loading) {
    return <div className="p-6">Cargando conteo de turno…</div>;
  }

  if (!cashSessionId) {
    return (
      <div className="p-6">
        No hay sesión abierta. Debes abrir turno primero.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Conteo de Inventario - Inicio de Turno
      </h1>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Producto</th>
              <th className="p-3">Refrigerador</th>
              <th className="p-3">Bodega</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t">
                <td className="p-3">{product.name}</td>

                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={counts[product.id]?.fridge ?? ""}
                    onChange={(e) =>
                      setCounts({
                        ...counts,
                        [product.id]: {
                          ...counts[product.id],
                          fridge: Number(e.target.value),
                        },
                      })
                    }
                    className="border rounded px-2 py-1 w-24"
                  />
                </td>

                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    value={counts[product.id]?.warehouse ?? ""}
                    onChange={(e) =>
                      setCounts({
                        ...counts,
                        [product.id]: {
                          ...counts[product.id],
                          warehouse: Number(e.target.value),
                        },
                      })
                    }
                    className="border rounded px-2 py-1 w-24"
                  />
                </td>

                <td className="p-3">
                  <button
                    onClick={() => saveCount(product.id)}
                    disabled={savingProductId === product.id}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingProductId === product.id
                      ? "Guardando..."
                      : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}