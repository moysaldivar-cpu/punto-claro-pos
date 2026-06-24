import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdjustInventoryModal from "@/components/AdjustInventoryModal";
import MoveInventoryModal, {
  MoveMode,
} from "@/components/MoveInventoryModal";
import { useAuth } from "@/contexts/AuthContext";

type InventoryRow = {
  id: string;
  product_id: string;
  store_id: string;
  stock: number;
  min_stock: number;
  product_name: string;
  product_active: boolean;
  store_name: string;
  exists_in_inventory: boolean;
};

type StoreOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  active: boolean;
};

type BulkInventoryResult = {
  created: number;
  updated: number;
  notFound: string[];
  invalidLines: string[];
};

export default function Inventory() {
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkInventoryResult | null>(
    null
  );

  // I3 – ajuste absoluto
  const [selectedAdjust, setSelectedAdjust] =
    useState<InventoryRow | null>(null);

  // I5 – entrada / salida
  const [selectedMove, setSelectedMove] = useState<InventoryRow | null>(null);
  const [moveMode, setMoveMode] = useState<MoveMode>("in");

  const localStoreId = localStorage.getItem("store_id") || "";
  const isAdmin = user?.rol === "admin";

  useEffect(() => {
    if (authLoading) return;

    async function loadAll() {
      setLoading(true);
      await Promise.all([loadStores(), loadProducts(), loadInventory()]);
      setLoading(false);
    }

    loadAll();
  }, [authLoading, user?.rol, user?.store_id]);

  async function loadStores() {
    if (!user) {
      setStores([]);
      return;
    }

    if (!isAdmin) {
      if (user.store_id) {
        const { data } = await supabase
          .from("pos_stores")
          .select("id, name")
          .eq("id", user.store_id)
          .maybeSingle();

        if (data) {
          setStores([data]);
          setSelectedStoreId(data.id);
        } else {
          setStores([]);
        }
      } else {
        setStores([]);
      }

      return;
    }

    const { data, error } = await supabase
      .from("pos_stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error loading stores:", error);
      setStores([]);
      return;
    }

    setStores(data ?? []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, active")
      .order("name");

    if (error) {
      console.error("Error loading products:", error);
      setProducts([]);
      return;
    }

    setProducts((data ?? []) as ProductOption[]);
  }

  async function loadInventory() {
    if (!user) {
      setRows([]);
      return;
    }

    let query = supabase.from("inventory").select(`
        id,
        product_id,
        store_id,
        stock,
        min_stock,
        products!inner (
          name,
          active
        ),
        pos_stores (
          name
        )
      `);

    if (!isAdmin && user.store_id) {
      query = query.eq("store_id", user.store_id);
    }

    const { data, error } = await query.order("store_id");

    if (error) {
      console.error("Error loading inventory:", error);
      setRows([]);
      return;
    }

    const mapped =
      (data ?? []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        store_id: r.store_id,
        stock: r.stock ?? 0,
        min_stock: r.min_stock ?? 0,
        product_name: r.products?.name ?? "(Sin nombre)",
        product_active: r.products?.active ?? true,
        store_name: r.pos_stores?.name ?? "(Sin sucursal)",
        exists_in_inventory: true,
      })) ?? [];

    mapped.sort((a, b) => {
      if (a.store_name !== b.store_name) {
        return a.store_name.localeCompare(b.store_name);
      }

      return a.product_name.localeCompare(b.product_name);
    });

    setRows(mapped);
  }

  async function refreshInventoryOnly() {
    setLoading(true);
    await loadInventory();
    setLoading(false);
  }

  const selectedStore = stores.find((store) => store.id === selectedStoreId);

  const visibleRows = useMemo(() => {
    if (!isAdmin) {
      const storeId = user?.store_id || localStoreId;
      const storeName = stores[0]?.name ?? "(Sin sucursal)";

      const existingByProductId = new Map(
        rows
          .filter((row) => row.store_id === storeId)
          .map((row) => [row.product_id, row])
      );

      return products.map((product) => {
        const existing = existingByProductId.get(product.id);

        if (existing) {
          return existing;
        }

        return {
          id: "",
          product_id: product.id,
          store_id: storeId,
          stock: 0,
          min_stock: 0,
          product_name: product.name,
          product_active: product.active,
          store_name: storeName,
          exists_in_inventory: false,
        };
      });
    }

    if (selectedStoreId === "all") {
      return rows;
    }

    const existingByProductId = new Map(
      rows
        .filter((row) => row.store_id === selectedStoreId)
        .map((row) => [row.product_id, row])
    );

    return products.map((product) => {
      const existing = existingByProductId.get(product.id);

      if (existing) {
        return existing;
      }

      return {
        id: "",
        product_id: product.id,
        store_id: selectedStoreId,
        stock: 0,
        min_stock: 0,
        product_name: product.name,
        product_active: product.active,
        store_name: selectedStore?.name ?? "(Sin sucursal)",
        exists_in_inventory: false,
      };
    });
  }, [
    rows,
    products,
    stores,
    isAdmin,
    selectedStoreId,
    selectedStore?.name,
    user?.store_id,
    localStoreId,
  ]);

  async function ensureInventoryRow(row: InventoryRow): Promise<InventoryRow> {
    if (row.id) {
      return row;
    }

    if (!row.store_id) {
      throw new Error("No se encontró la sucursal para asignar inventario.");
    }

    const { data, error } = await supabase
      .from("inventory")
      .insert({
        product_id: row.product_id,
        store_id: row.store_id,
        stock: 0,
        min_stock: 0,
      })
      .select(`
        id,
        product_id,
        store_id,
        stock,
        min_stock,
        products!inner (
          name,
          active
        ),
        pos_stores (
          name
        )
      `)
      .single();

    if (error) {
      console.error("Error creando registro de inventario:", error);
      throw error;
    }

    const inventoryData: any = data;

    const newRow: InventoryRow = {
      id: inventoryData.id,
      product_id: inventoryData.product_id,
      store_id: inventoryData.store_id,
      stock: inventoryData.stock ?? 0,
      min_stock: inventoryData.min_stock ?? 0,
      product_name: inventoryData.products?.name ?? row.product_name,
      product_active: inventoryData.products?.active ?? row.product_active,
      store_name: inventoryData.pos_stores?.name ?? row.store_name,
      exists_in_inventory: true,
    };

    await loadInventory();

    return newRow;
  }

  function parseBulkInventoryText(text: string) {
    const invalidLines: string[] = [];
    const parsedRows: { sku: string; stock: number; originalLine: string }[] =
      [];

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line, index) => {
      const lower = line.toLowerCase();

      if (
        index === 0 &&
        lower.includes("sku") &&
        (lower.includes("stock") || lower.includes("inventario"))
      ) {
        return;
      }

      let parts = line
        .split(/[,\t;]/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length < 2) {
        parts = line
          .split(/\s+/)
          .map((part) => part.trim())
          .filter(Boolean);
      }

      if (parts.length < 2) {
        invalidLines.push(line);
        return;
      }

      const sku = parts[0].trim();
      const stockText = parts[1].trim();
      const stock = Number(stockText);

      if (!sku || !Number.isFinite(stock) || stock < 0) {
        invalidLines.push(line);
        return;
      }

      parsedRows.push({
        sku,
        stock,
        originalLine: line,
      });
    });

    return {
      parsedRows,
      invalidLines,
    };
  }

  async function handleBulkInventoryLoad() {
    if (!isAdmin) {
      alert("Solo el administrador puede usar la carga masiva.");
      return;
    }

    if (!selectedStoreId || selectedStoreId === "all") {
      alert("Selecciona una sucursal específica antes de cargar inventario.");
      return;
    }

    if (!bulkText.trim()) {
      alert("Pega una lista de SKU y stock antes de cargar.");
      return;
    }

    const confirmLoad = window.confirm(
      "Esta carga ajustará el stock absoluto de la sucursal seleccionada. ¿Deseas continuar?"
    );

    if (!confirmLoad) return;

    setBulkLoading(true);
    setBulkResult(null);

    const { parsedRows, invalidLines } = parseBulkInventoryText(bulkText);

    const productBySku = new Map<string, ProductOption>();

    products.forEach((product) => {
      const sku = String(product.sku || "").trim().toLowerCase();
      if (sku) {
        productBySku.set(sku, product);
      }
    });

    let created = 0;
    let updated = 0;
    const notFound: string[] = [...invalidLines.map((line) => "")].filter(
      Boolean
    );
    const realNotFound: string[] = [];

    try {
      for (const parsed of parsedRows) {
        const skuKey = parsed.sku.trim().toLowerCase();
        const product = productBySku.get(skuKey);

        if (!product) {
          realNotFound.push(parsed.sku);
          continue;
        }

        const { data: existing, error: existingError } = await supabase
          .from("inventory")
          .select("id")
          .eq("store_id", selectedStoreId)
          .eq("product_id", product.id)
          .maybeSingle();

        if (existingError) {
          invalidLines.push(
            `${parsed.originalLine} | Error consultando inventario`
          );
          continue;
        }

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("inventory")
            .update({
              stock: parsed.stock,
            })
            .eq("id", existing.id);

          if (updateError) {
            invalidLines.push(
              `${parsed.originalLine} | Error actualizando stock`
            );
            continue;
          }

          updated += 1;
        } else {
          const { error: insertError } = await supabase
            .from("inventory")
            .insert({
              product_id: product.id,
              store_id: selectedStoreId,
              stock: parsed.stock,
              min_stock: 0,
            });

          if (insertError) {
            invalidLines.push(`${parsed.originalLine} | Error creando stock`);
            continue;
          }

          created += 1;
        }
      }

      await loadInventory();

      setBulkResult({
        created,
        updated,
        notFound: realNotFound,
        invalidLines,
      });

      alert(
        `Carga terminada. Creados: ${created}. Actualizados: ${updated}. No encontrados: ${realNotFound.length}. Líneas con error: ${invalidLines.length}.`
      );
    } catch (error: any) {
      console.error("Error en carga masiva:", error);
      alert(error.message || "Error al cargar inventario masivo.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function openMove(row: InventoryRow, mode: MoveMode) {
    try {
      const inventoryRow = await ensureInventoryRow(row);
      setSelectedMove(inventoryRow);
      setMoveMode(mode);
    } catch (error: any) {
      alert(error.message ?? "No se pudo preparar el inventario.");
    }
  }

  async function openAdjust(row: InventoryRow) {
    try {
      const inventoryRow = await ensureInventoryRow(row);
      setSelectedAdjust(inventoryRow);
    } catch (error: any) {
      alert(error.message ?? "No se pudo preparar el inventario.");
    }
  }

  async function handleMoveConfirm(payload: {
    delta: number;
    reason: string;
  }) {
    if (!selectedMove) return;

    const { error } = await supabase.rpc("move_inventory", {
      p_inventory_id: selectedMove.id,
      p_product_id: selectedMove.product_id,
      p_store_id: selectedMove.store_id,
      p_delta: payload.delta,
      p_reason: payload.reason,
    });

    if (error) {
      console.error("Error move_inventory:", error);
      throw error;
    }

    await refreshInventoryOnly();
  }

  if (authLoading || loading) {
    return <div>Cargando inventario…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Inventario</h1>
        <p className="text-gray-600">
          Administra el stock por sucursal. Al seleccionar una sucursal
          específica, aparecerán todos los productos, incluso los que todavía no
          tienen inventario asignado.
        </p>
      </div>

      {isAdmin && (
        <div className="bg-white p-6 rounded shadow">
          <label className="block text-sm font-medium mb-1">Sucursal</label>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setBulkResult(null);
            }}
            className="border rounded px-3 py-2 min-w-[260px]"
          >
            <option value="all">Todas las sucursales</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>

          {selectedStoreId === "all" && (
            <p className="text-sm text-gray-500 mt-2">
              Para asignar inventario inicial a productos nuevos, selecciona una
              sucursal específica.
            </p>
          )}
        </div>
      )}

      {isAdmin && selectedStoreId !== "all" && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-2">
            Carga masiva de inventario
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Pega una lista con formato <strong>SKU, STOCK</strong>. Esta carga
            ajusta el stock absoluto de la sucursal seleccionada:{" "}
            <strong>{selectedStore?.name}</strong>.
          </p>

          <div className="bg-gray-50 border rounded p-3 text-xs text-gray-600 mb-3">
            Ejemplo:
            <pre className="mt-2 whitespace-pre-wrap">
{`SKU, STOCK
7501064190711, 24
7501064199271, 12
TEST-ADMIN-001, 13`}
            </pre>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`SKU, STOCK
7501064190711, 24
7501064199271, 12`}
            className="border rounded w-full min-h-[180px] p-3 font-mono text-sm"
            disabled={bulkLoading}
          />

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={handleBulkInventoryLoad}
              disabled={bulkLoading || !bulkText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
            >
              {bulkLoading ? "Cargando..." : "Cargar inventario"}
            </button>

            <button
              onClick={() => {
                setBulkText("");
                setBulkResult(null);
              }}
              disabled={bulkLoading}
              className="border px-4 py-2 rounded font-semibold disabled:opacity-50"
            >
              Limpiar
            </button>
          </div>

          {bulkResult && (
            <div className="mt-4 rounded border bg-gray-50 p-4 text-sm">
              <h3 className="font-bold mb-2">Resultado de carga</h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                <div className="rounded bg-white border p-3">
                  <div className="text-gray-500">Creados</div>
                  <div className="text-2xl font-bold">
                    {bulkResult.created}
                  </div>
                </div>

                <div className="rounded bg-white border p-3">
                  <div className="text-gray-500">Actualizados</div>
                  <div className="text-2xl font-bold">
                    {bulkResult.updated}
                  </div>
                </div>

                <div className="rounded bg-white border p-3">
                  <div className="text-gray-500">SKU no encontrados</div>
                  <div className="text-2xl font-bold">
                    {bulkResult.notFound.length}
                  </div>
                </div>

                <div className="rounded bg-white border p-3">
                  <div className="text-gray-500">Líneas con error</div>
                  <div className="text-2xl font-bold">
                    {bulkResult.invalidLines.length}
                  </div>
                </div>
              </div>

              {bulkResult.notFound.length > 0 && (
                <div className="mb-3">
                  <div className="font-semibold text-red-700 mb-1">
                    SKU no encontrados:
                  </div>
                  <div className="bg-white border rounded p-2 max-h-32 overflow-auto">
                    {bulkResult.notFound.map((sku) => (
                      <div key={sku}>{sku}</div>
                    ))}
                  </div>
                </div>
              )}

              {bulkResult.invalidLines.length > 0 && (
                <div>
                  <div className="font-semibold text-red-700 mb-1">
                    Líneas con error:
                  </div>
                  <div className="bg-white border rounded p-2 max-h-32 overflow-auto">
                    {bulkResult.invalidLines.map((line, index) => (
                      <div key={`${line}-${index}`}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white p-6 rounded shadow">
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                {isAdmin && selectedStoreId === "all" && (
                  <th className="border p-2">Sucursal</th>
                )}
                <th className="border p-2">Producto</th>
                <th className="border p-2">Stock</th>
                <th className="border p-2">Mínimo</th>
                <th className="border p-2">Estado</th>
                <th className="border p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((r) => (
                <tr
                  key={`${r.store_id}-${r.product_id}`}
                  className={`border-t ${
                    r.exists_in_inventory ? "" : "bg-yellow-50"
                  }`}
                >
                  {isAdmin && selectedStoreId === "all" && (
                    <td className="border p-2">{r.store_name}</td>
                  )}

                  <td className="border p-2">
                    <div className="font-medium">{r.product_name}</div>
                    {!r.product_active && (
                      <div className="text-xs text-red-600">
                        Producto inactivo
                      </div>
                    )}
                  </td>

                  <td className="border p-2">{r.stock}</td>

                  <td className="border p-2">{r.min_stock}</td>

                  <td className="border p-2">
                    {r.exists_in_inventory ? (
                      <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                        Con inventario
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-semibold">
                        Sin asignar
                      </span>
                    )}
                  </td>

                  <td className="border p-2">
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="text-green-700 underline text-sm"
                        onClick={() => openMove(r, "in")}
                      >
                        Entrada
                      </button>

                      <button
                        className="text-red-700 underline text-sm"
                        onClick={() => openMove(r, "out")}
                      >
                        Salida
                      </button>

                      <button
                        onClick={() => openAdjust(r)}
                        className="text-blue-600 underline text-sm"
                      >
                        Ajustar inventario
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {visibleRows.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin && selectedStoreId === "all" ? 6 : 5}
                    className="p-4 text-center text-gray-500"
                  >
                    No hay inventario para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Nota: si un producto aparece como “Sin asignar”, al registrar una
          entrada o ajustar inventario se creará automáticamente su registro de
          inventario para esa sucursal.
        </p>
      </div>

      <AdjustInventoryModal
        open={!!selectedAdjust}
        inventoryId={selectedAdjust?.id ?? ""}
        productId={selectedAdjust?.product_id ?? ""}
        storeId={selectedAdjust?.store_id ?? localStoreId}
        currentStock={selectedAdjust?.stock ?? 0}
        productName={selectedAdjust?.product_name ?? ""}
        onClose={() => setSelectedAdjust(null)}
        onSaved={refreshInventoryOnly}
      />

      <MoveInventoryModal
        open={!!selectedMove}
        mode={moveMode}
        productName={selectedMove?.product_name}
        currentStock={selectedMove?.stock}
        onClose={() => setSelectedMove(null)}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}