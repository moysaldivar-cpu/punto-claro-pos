import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const storeId = user?.store_id || localStorage.getItem("store_id");

  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<
    Record<string, { fridge: number; warehouse: number }>
  >({});
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
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

  function updateCount(
    productId: string,
    field: "fridge" | "warehouse",
    value: string
  ) {
    const parsed = value === "" ? 0 : Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }

    setCounts((prev) => ({
      ...prev,
      [productId]: {
        fridge: field === "fridge" ? parsed : prev[productId]?.fridge ?? 0,
        warehouse:
          field === "warehouse" ? parsed : prev[productId]?.warehouse ?? 0,
      },
    }));
  }

  async function saveAllCountsAndFinish() {
    if (!cashSessionId || !storeId || !user?.id) {
      alert("No hay sesión, usuario o sucursal activa.");
      return;
    }

    if (products.length === 0) {
      navigate("/pos");
      return;
    }

    setSavingAll(true);

    const { data: currentSession, error: sessionError } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("id", cashSessionId)
      .eq("store_id", storeId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .maybeSingle();

    if (sessionError) {
      setSavingAll(false);
      alert("Error al validar turno: " + sessionError.message);
      return;
    }

    if (!currentSession) {
      setSavingAll(false);
      alert(
        "El turno ya no está abierto para este usuario en esta sucursal. Actualiza la pantalla y vuelve a intentar."
      );
      return;
    }

    const rowsToSave = products.map((product) => {
      const productCount = counts[product.id] || {
        fridge: 0,
        warehouse: 0,
      };

      return {
        store_id: storeId,
        cash_session_id: cashSessionId,
        product_id: product.id,
        fridge_qty: Number(productCount.fridge || 0),
        warehouse_qty: Number(productCount.warehouse || 0),
        created_by: user.id,
      };
    });

    const chunks = chunkArray(rowsToSave, 100);

    for (const chunk of chunks) {
      const { error } = await supabase.from("inventory_counts").upsert(chunk, {
        onConflict: "cash_session_id,product_id",
      });

      if (error) {
        console.error(error);
        setSavingAll(false);
        alert("Error al guardar el conteo completo.");
        return;
      }
    }

    setSavingAll(false);
    alert("Conteo de inventario guardado correctamente.");
    navigate("/pos");
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
    <div className="p-3 sm:p-6 pb-28">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Conteo de Inventario - Inicio de Turno
          </h1>

          <p className="text-sm text-gray-600 mt-1">
            Captura refrigerador y bodega. Al terminar, presiona Guardar todo.
          </p>
        </div>

        <button
          onClick={saveAllCountsAndFinish}
          disabled={savingAll}
          className="bg-green-600 text-white px-4 py-3 rounded font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {savingAll ? "Guardando conteo..." : "Guardar todo y concluir inventario"}
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-4 text-gray-500">
          No hay productos disponibles para esta sucursal.
        </div>
      ) : (
        <>
          <div className="hidden lg:block bg-white shadow rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Refrigerador</th>
                  <th className="p-3">Bodega</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t">
                    <td className="p-3 font-medium">{product.name}</td>

                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        value={counts[product.id]?.fridge ?? ""}
                        onChange={(e) =>
                          updateCount(product.id, "fridge", e.target.value)
                        }
                        className="border rounded px-2 py-2 w-32"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        value={counts[product.id]?.warehouse ?? ""}
                        onChange={(e) =>
                          updateCount(product.id, "warehouse", e.target.value)
                        }
                        className="border rounded px-2 py-2 w-32"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white shadow rounded-lg p-4 border"
              >
                <div className="font-semibold text-lg leading-tight mb-3">
                  {product.name}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-sm text-gray-600 mb-1">
                      Refrigerador
                    </span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={counts[product.id]?.fridge ?? ""}
                      onChange={(e) =>
                        updateCount(product.id, "fridge", e.target.value)
                      }
                      className="border rounded px-3 py-2 w-full text-lg"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm text-gray-600 mb-1">
                      Bodega
                    </span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={counts[product.id]?.warehouse ?? ""}
                      onChange={(e) =>
                        updateCount(product.id, "warehouse", e.target.value)
                      }
                      className="border rounded px-3 py-2 w-full text-lg"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 lg:hidden">
        <button
          onClick={saveAllCountsAndFinish}
          disabled={savingAll}
          className="bg-green-600 text-white px-4 py-3 rounded w-full font-semibold disabled:opacity-50"
        >
          {savingAll ? "Guardando conteo..." : "Guardar todo y concluir inventario"}
        </button>
      </div>
    </div>
  );
}