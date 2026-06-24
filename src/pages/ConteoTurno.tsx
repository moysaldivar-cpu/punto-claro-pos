import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePosAuth } from "@/contexts/AuthContext";

type Product = {
  id: string;
  name: string;
};

type InventoryRow = {
  product_id: string;
  stock: number;
};

type InventoryCount = {
  product_id: string;
  fridge_qty: number;
  warehouse_qty: number;
};

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

export default function ConteoTurno() {
  const { user } = usePosAuth();

  const storeId = user?.store_id || localStorage.getItem("store_id");

  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { fridge: number; warehouse: number }>
  >({});
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");
      setProducts([]);
      setCounts({});
      setCashSessionId(null);

      if (!storeId) {
        setError("No hay sucursal activa para esta sesión.");
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setError("No hay usuario activo para esta sesión.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("store_id", storeId)
        .eq("opened_by", user.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) {
        setError("Error al cargar sesión abierta: " + sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData) {
        const { data: otherSession } = await supabase
          .from("cash_sessions")
          .select("id, opened_by")
          .eq("store_id", storeId)
          .eq("status", "open")
          .neq("opened_by", user.id)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (otherSession) {
          setError(
            "Esta sucursal tiene un turno abierto por otro usuario. Para capturar conteo aquí, debe ingresar el usuario que abrió ese turno."
          );
        } else {
          setError("No hay sesión abierta para este usuario en esta sucursal.");
        }

        setLoading(false);
        return;
      }

      setCashSessionId(sessionData.id);

      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory")
        .select("product_id, stock")
        .eq("store_id", storeId);

      if (inventoryError) {
        setError("Error al cargar inventario: " + inventoryError.message);
        setLoading(false);
        return;
      }

      const typedInventory = (inventoryData || []) as InventoryRow[];
      const productIds = typedInventory.map((row) => row.product_id);

      if (productIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productChunks = chunkArray(productIds, 80);
      const allProducts: Product[] = [];

      for (const chunk of productChunks) {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("id, name")
          .in("id", chunk);

        if (productsError) {
          setError("Error al cargar productos: " + productsError.message);
          setLoading(false);
          return;
        }

        allProducts.push(...((productsData || []) as Product[]));
      }

      const sortedProducts = allProducts.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setProducts(sortedProducts);

      const { data: countsData, error: countsError } = await supabase
        .from("inventory_counts")
        .select("product_id, fridge_qty, warehouse_qty")
        .eq("cash_session_id", sessionData.id);

      if (countsError) {
        setError("Error al cargar conteos existentes: " + countsError.message);
        setLoading(false);
        return;
      }

      const countsMap: Record<string, { fridge: number; warehouse: number }> = {};

      countsData?.forEach((c: InventoryCount) => {
        countsMap[c.product_id] = {
          fridge: Number(c.fridge_qty || 0),
          warehouse: Number(c.warehouse_qty || 0),
        };
      });

      setCounts(countsMap);
      setLoading(false);
    }

    loadData();
  }, [storeId, user?.id]);

  async function saveCount(productId: string) {
    if (!cashSessionId || !storeId || !user?.id) return;

    const productCount = counts[productId] || {
      fridge: 0,
      warehouse: 0,
    };

    setSavingProductId(productId);

    const { data: currentSession, error: sessionError } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("id", cashSessionId)
      .eq("store_id", storeId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle();

    if (sessionError) {
      setSavingProductId(null);
      alert("Error al validar turno: " + sessionError.message);
      return;
    }

    if (!currentSession) {
      setSavingProductId(null);
      alert(
        "El turno ya no está abierto para este usuario en esta sucursal. Actualiza la pantalla y vuelve a intentar."
      );
      return;
    }

    const { error } = await supabase.from("inventory_counts").upsert(
      {
        store_id: storeId,
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

  if (error) {
    return <div className="p-6 text-red-600 font-semibold">{error}</div>;
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
                          fridge: Number(e.target.value),
                          warehouse: counts[product.id]?.warehouse ?? 0,
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
                          fridge: counts[product.id]?.fridge ?? 0,
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

            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-gray-500">
                  No hay productos disponibles para esta sucursal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}