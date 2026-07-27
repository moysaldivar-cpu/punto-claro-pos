import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  category: string;
  active: boolean;
};

type StoreOption = {
  id: string;
  name: string;
};

type StoreInventoryStatus = {
  id: string;
  store_id: string;
  stock: number;
  min_stock: number;
  is_active: boolean;
};

const CATEGORIES = [
  "CERVEZA",
  "BEBIDAS",
  "BOTANAS",
  "ABARROTES",
  "PAN",
  "GALLETAS",
  "DULCES",
  "HIGIENE",
  "OTROS",
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [managingProduct, setManagingProduct] = useState<Product | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newCategory, setNewCategory] = useState("OTROS");
  const [newStoreId, setNewStoreId] = useState("");
  const [newInitialStock, setNewInitialStock] = useState("0");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [activeFilter, setActiveFilter] = useState("todos");

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);

    await Promise.all([loadProducts(), loadStores()]);

    setLoading(false);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, price, cost, category, active")
      .order("name");

    if (error) {
      console.error("Error loading products:", error);
      alert("No se pudieron cargar los productos.");
      setProducts([]);
      return;
    }

    setProducts(
      (data ?? []).map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.price || 0),
        cost: Number(product.cost || 0),
        category: String(product.category || "OTROS"),
        active: Boolean(product.active),
      }))
    );
  }

  async function loadStores() {
    const { data, error } = await supabase
      .from("pos_stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error loading stores:", error);
      alert("No se pudieron cargar las sucursales.");
      setStores([]);
      setNewStoreId("");
      return;
    }

    const activeStores = (data ?? []) as StoreOption[];

    setStores(activeStores);

    if (!newStoreId && activeStores.length > 0) {
      setNewStoreId(activeStores[0].id);
    }
  }

  const filteredProducts = useMemo(() => {
    let list = [...products];

    const term = normalizeText(search);

    if (term) {
      list = list.filter((product) => {
        const name = normalizeText(product.name);
        const sku = normalizeText(product.sku);

        return name.includes(term) || sku.includes(term);
      });
    }

    if (categoryFilter !== "TODAS") {
      list = list.filter((product) => product.category === categoryFilter);
    }

    if (activeFilter === "activos") {
      list = list.filter((product) => product.active);
    }

    if (activeFilter === "inactivos") {
      list = list.filter((product) => !product.active);
    }

    return list;
  }, [products, search, categoryFilter, activeFilter]);

  function resetCreateForm() {
    setNewName("");
    setNewSku("");
    setNewPrice("");
    setNewCost("");
    setNewCategory("OTROS");
    setNewInitialStock("0");

    if (stores.length > 0) {
      setNewStoreId(stores[0].id);
    } else {
      setNewStoreId("");
    }

    setShowCreateForm(false);
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("TODAS");
    setActiveFilter("todos");
  }

  async function findExistingProductBySku(cleanSku: string) {
    if (!cleanSku) return null;

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, price, cost, category, active")
      .eq("sku", cleanSku)
      .maybeSingle();

    if (error) {
      console.error("Error finding product by SKU:", error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      sku: data.sku,
      price: Number(data.price || 0),
      cost: Number(data.cost || 0),
      category: String(data.category || "OTROS"),
      active: Boolean(data.active),
    } as Product;
  }

  async function assignProductToStore({
    product,
    storeId,
    stock,
  }: {
    product: Product;
    storeId: string;
    stock: number;
  }) {
    const { data: existingInventory, error: existingInventoryError } =
      await supabase
        .from("inventory")
        .select("id, stock, is_active")
        .eq("product_id", product.id)
        .eq("store_id", storeId)
        .maybeSingle();

    if (existingInventoryError) {
      console.error("Error checking inventory:", existingInventoryError);
      throw existingInventoryError;
    }

    if (existingInventory) {
      const currentStock = Number(existingInventory.stock || 0);
      const wasInactive = !Boolean(existingInventory.is_active);

      const shouldReplace = window.confirm(
        wasInactive
          ? `Este producto estaba retirado de esta sucursal y conserva stock ${currentStock}. ¿Deseas reactivarlo y establecer el stock en ${stock}?`
          : `Este producto ya está asignado a esta sucursal con stock ${currentStock}. ¿Deseas reemplazarlo por stock ${stock}?`
      );

      if (!shouldReplace) {
        return {
          assigned: false,
          updated: false,
          message: "Asignación cancelada. El inventario no se modificó.",
        };
      }

      const { error: updateInventoryError } = await supabase
        .from("inventory")
        .update({
          stock,
          is_active: true,
        })
        .eq("id", existingInventory.id);

      if (updateInventoryError) {
        console.error("Error updating inventory:", updateInventoryError);
        throw updateInventoryError;
      }

      return {
        assigned: true,
        updated: true,
        message: wasInactive
          ? `Producto reactivado en la sucursal con stock ${stock}.`
          : `Producto actualizado en la sucursal con stock ${stock}.`,
      };
    }

    const { error: insertInventoryError } = await supabase
      .from("inventory")
      .insert({
        product_id: product.id,
        store_id: storeId,
        stock,
        is_active: true,
      });

    if (insertInventoryError) {
      console.error("Error assigning product to store:", insertInventoryError);
      throw insertInventoryError;
    }

    return {
      assigned: true,
      updated: false,
      message: `Producto asignado a la sucursal con stock ${stock}.`,
    };
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = newName.trim();
    const cleanSku = newSku.trim();
    const priceNumber = Number(newPrice);
    const costNumber = Number(newCost || 0);
    const stockNumber = Number(newInitialStock || 0);

    if (!cleanName) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (!newPrice || Number.isNaN(priceNumber) || priceNumber < 0) {
      alert("Escribe un precio de venta válido.");
      return;
    }

    if (Number.isNaN(costNumber) || costNumber < 0) {
      alert("Escribe un costo válido.");
      return;
    }

    if (!newStoreId) {
      alert("Selecciona una sucursal para asignar el producto.");
      return;
    }

    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      alert("Escribe un stock inicial válido.");
      return;
    }

    setSaving(true);

    try {
      const existingProduct = await findExistingProductBySku(cleanSku);

      if (existingProduct) {
        const shouldAssign = window.confirm(
          `El SKU ${cleanSku} ya existe en el catálogo como "${existingProduct.name}". No se creará duplicado. ¿Deseas asignarlo a la sucursal seleccionada con stock ${stockNumber}?`
        );

        if (!shouldAssign) {
          setSaving(false);
          return;
        }

        const result = await assignProductToStore({
          product: existingProduct,
          storeId: newStoreId,
          stock: stockNumber,
        });

        alert(result.message);

        resetCreateForm();
        await loadProducts();
        setSaving(false);
        return;
      }

      const { data: createdProduct, error: createProductError } = await supabase
        .from("products")
        .insert({
          name: cleanName,
          sku: cleanSku || null,
          price: round2(priceNumber),
          cost: round2(costNumber),
          category: newCategory || "OTROS",
          active: true,

          // Campos legacy presentes en la tabla.
          // El stock real por sucursal se maneja en inventory.
          stock: stockNumber,
          store_id: newStoreId,
        })
        .select("id, name, sku, price, cost, category, active")
        .single();

      if (createProductError || !createdProduct) {
        throw createProductError || new Error("No se pudo crear el producto.");
      }

      const productForInventory: Product = {
        id: createdProduct.id,
        name: createdProduct.name,
        sku: createdProduct.sku,
        price: Number(createdProduct.price || 0),
        cost: Number(createdProduct.cost || 0),
        category: String(createdProduct.category || "OTROS"),
        active: Boolean(createdProduct.active),
      };

      await assignProductToStore({
        product: productForInventory,
        storeId: newStoreId,
        stock: stockNumber,
      });

      alert("Producto creado y asignado a la sucursal correctamente.");

      resetCreateForm();
      await loadProducts();
    } catch (err: any) {
      console.error("Error creating/assigning product:", err);

      if (err?.code === "23505") {
        alert(
          "Ese SKU ya existe. El producto no debe duplicarse; debe asignarse a la sucursal desde el flujo de alta."
        );
      } else {
        alert(err?.message || "No se pudo guardar el producto.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    const nextActive = !product.active;

    const shouldContinue = window.confirm(
      nextActive
        ? `¿Deseas reactivar "${product.name}" en el catálogo general? Volverá a estar disponible en las sucursales donde su inventario esté activo.`
        : `¿Deseas desactivar "${product.name}" del catálogo general? Se ocultará en TODAS las sucursales. Para retirarlo solo de una sucursal, usa "Administrar sucursales".`
    );

    if (!shouldContinue) return;

    const { error } = await supabase
      .from("products")
      .update({ active: nextActive })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  if (loading) {
    return <div>Cargando productos…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Productos</h1>
            <p className="text-gray-600 mt-1">
              Administra el catálogo general de productos. El SKU o código de
              barras es único; si el producto ya existe, se asigna a la sucursal
              seleccionada sin duplicarlo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((value) => !value)}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            {showCreateForm ? "Cancelar" : "Agregar producto"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">
            Nuevo producto o asignación a sucursal
          </h2>

          <form
            onSubmit={createProduct}
            className="grid grid-cols-1 md:grid-cols-6 gap-4"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nombre del producto
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Corona Extra 355 ml"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                SKU / Código de barras
              </label>
              <input
                type="text"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
                placeholder="Ej. 7501064191452"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Precio de venta
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                placeholder="0.00"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Categoría / Departamento
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">
                Sucursal
              </label>
              <select
                value={newStoreId}
                onChange={(e) => setNewStoreId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {stores.length === 0 && (
                  <option value="">No hay sucursales activas</option>
                )}

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Si el SKU ya existe, el producto se asignará a esta sucursal en
                inventario sin duplicarse.
              </p>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">
                Stock inicial en la sucursal
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={newInitialStock}
                onChange={(e) => setNewInitialStock(e.target.value)}
                placeholder="0"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar producto / asignar"}
              </button>

              <button
                type="button"
                onClick={resetCreateForm}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Buscar por nombre o SKU
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej. corona, 750106, producto prueba..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Categoría / Departamento
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="TODAS">Todas</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 items-center">
          <button
            type="button"
            onClick={clearFilters}
            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
          >
            Limpiar filtros
          </button>

          <span className="text-sm text-gray-600">
            Mostrando <strong>{filteredProducts.length}</strong> de{" "}
            <strong>{products.length}</strong> productos.
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Productos registrados</h2>

        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="border p-2">Nombre</th>
                <th className="border p-2">SKU / Código</th>
                <th className="border p-2">Categoría</th>
                <th className="border p-2">Costo</th>
                <th className="border p-2">Precio venta</th>
                <th className="border p-2">Margen</th>
                <th className="border p-2">Activo global</th>
                <th className="border p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No hay productos que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {filteredProducts.map((p) => {
                const margin = round2(p.price - p.cost);

                return (
                  <tr
                    key={p.id}
                    className={`border-t hover:bg-gray-50 ${
                      !p.active ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="border p-2 font-medium">
                      {p.name}

                      {!p.active && (
                        <div className="text-xs text-red-600 font-semibold">
                          Producto inactivo
                        </div>
                      )}
                    </td>

                    <td className="border p-2">{p.sku ?? "-"}</td>

                    <td className="border p-2">{p.category || "OTROS"}</td>

                    <td className="border p-2">${p.cost.toFixed(2)}</td>

                    <td className="border p-2">${p.price.toFixed(2)}</td>

                    <td
                      className={`border p-2 font-semibold ${
                        margin < 0 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      ${margin.toFixed(2)}
                    </td>

                    <td className="border p-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.active}
                          onChange={() => toggleActive(p)}
                        />

                        <span>{p.active ? "Sí" : "No"}</span>
                      </label>
                    </td>

                    <td className="border p-2">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(p)}
                          className="text-blue-600 underline text-sm"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => setManagingProduct(p)}
                          className="text-purple-700 underline text-sm"
                        >
                          Administrar sucursales
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Nota: “Activo global” afecta todas las sucursales. Para retirar o
          reactivar un producto únicamente en una sucursal, usa “Administrar
          sucursales”. El stock y el historial se conservan.
        </p>
      </div>

      <EditProductModal
        open={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSaved={async () => {
          setEditingProduct(null);
          await loadProducts();
        }}
      />

      <ManageProductStoresModal
        open={!!managingProduct}
        product={managingProduct}
        stores={stores}
        onClose={() => setManagingProduct(null)}
      />
    </div>
  );
}

function ManageProductStoresModal({
  open,
  product,
  stores,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  stores: StoreOption[];
  onClose: () => void;
}) {
  const [inventoryRows, setInventoryRows] = useState<StoreInventoryStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStoreId, setUpdatingStoreId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open || !product) {
      setInventoryRows([]);
      setErrorMessage("");
      return;
    }

    loadInventoryRows();
  }, [open, product]);

  async function loadInventoryRows() {
    if (!product) return;

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("inventory")
      .select("id, store_id, stock, min_stock, is_active")
      .eq("product_id", product.id);

    if (error) {
      console.error("Error loading product stores:", error);
      setInventoryRows([]);
      setErrorMessage("No se pudo cargar el estado del producto por sucursal.");
      setLoading(false);
      return;
    }

    setInventoryRows(
      (data ?? []).map((row: any) => ({
        id: row.id,
        store_id: row.store_id,
        stock: Number(row.stock || 0),
        min_stock: Number(row.min_stock || 0),
        is_active: Boolean(row.is_active),
      }))
    );

    setLoading(false);
  }

  async function assignToStore(store: StoreOption) {
    if (!product) return;

    const shouldAssign = window.confirm(
      `¿Deseas asignar "${product.name}" a ${store.name} con stock inicial 0? Después podrás ajustar sus existencias desde Inventario.`
    );

    if (!shouldAssign) return;

    setUpdatingStoreId(store.id);
    setErrorMessage("");

    const { error } = await supabase.from("inventory").insert({
      product_id: product.id,
      store_id: store.id,
      stock: 0,
      min_stock: 0,
      is_active: true,
    });

    if (error) {
      console.error("Error assigning product to store:", error);

      setErrorMessage(
        error.code === "23505"
          ? "El producto ya tiene un registro de inventario en esa sucursal. Recarga e inténtalo nuevamente."
          : "No se pudo asignar el producto a la sucursal."
      );

      setUpdatingStoreId(null);
      return;
    }

    await loadInventoryRows();
    setUpdatingStoreId(null);
  }

  async function updateStoreStatus(
    store: StoreOption,
    inventoryRow: StoreInventoryStatus
  ) {
    if (!product) return;

    const nextActive = !inventoryRow.is_active;

    const shouldContinue = window.confirm(
      nextActive
        ? `¿Deseas reactivar "${product.name}" en ${store.name}? Volverá a aparecer en el POS de esa sucursal con stock ${inventoryRow.stock}.`
        : `¿Deseas retirar "${product.name}" únicamente de ${store.name}? Dejará de aparecer en el POS de esa sucursal. Se conservarán el stock (${inventoryRow.stock}), los movimientos y el historial.`
    );

    if (!shouldContinue) return;

    setUpdatingStoreId(store.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("inventory")
      .update({ is_active: nextActive })
      .eq("id", inventoryRow.id);

    if (error) {
      console.error("Error updating store inventory status:", error);
      setErrorMessage("No se pudo actualizar el estado en la sucursal.");
      setUpdatingStoreId(null);
      return;
    }

    await loadInventoryRows();
    setUpdatingStoreId(null);
  }

  if (!open || !product) return null;

  const inventoryByStore = new Map<string, StoreInventoryStatus>(
    inventoryRows.map(
      (inventoryRow) =>
        [inventoryRow.store_id, inventoryRow] as const
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Administrar sucursales</h2>

            <p className="text-sm text-gray-600 mt-1">
              Producto: <strong>{product.name}</strong>
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Retirar un producto de una sucursal no elimina stock, movimientos
              ni ventas históricas.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={updatingStoreId !== null}
            className="border px-4 py-2 rounded disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-600">
            Cargando sucursales...
          </div>
        ) : stores.length === 0 ? (
          <div className="py-8 text-center text-gray-600">
            No hay sucursales activas.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="border p-2">Sucursal</th>
                  <th className="border p-2">Stock</th>
                  <th className="border p-2">Stock mínimo</th>
                  <th className="border p-2">Estado en sucursal</th>
                  <th className="border p-2">Acción</th>
                </tr>
              </thead>

              <tbody>
                {stores.map((store) => {
                  const inventoryRow = inventoryByStore.get(store.id);
                  const isUpdating = updatingStoreId === store.id;

                  return (
                    <tr key={store.id} className="border-t">
                      <td className="border p-2 font-medium">{store.name}</td>

                      <td className="border p-2">
                        {inventoryRow ? inventoryRow.stock : "-"}
                      </td>

                      <td className="border p-2">
                        {inventoryRow ? inventoryRow.min_stock : "-"}
                      </td>

                      <td className="border p-2">
                        {!inventoryRow ? (
                          <span className="font-semibold text-gray-500">
                            No asignado
                          </span>
                        ) : inventoryRow.is_active ? (
                          <span className="font-semibold text-green-700">
                            Activo
                          </span>
                        ) : (
                          <span className="font-semibold text-red-700">
                            Retirado
                          </span>
                        )}
                      </td>

                      <td className="border p-2">
                        {!inventoryRow ? (
                          <button
                            type="button"
                            onClick={() => assignToStore(store)}
                            disabled={isUpdating}
                            className="text-blue-700 underline disabled:opacity-50"
                          >
                            {isUpdating ? "Asignando..." : "Asignar con stock 0"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              updateStoreStatus(store, inventoryRow)
                            }
                            disabled={isUpdating}
                            className={`underline disabled:opacity-50 ${
                              inventoryRow.is_active
                                ? "text-red-700"
                                : "text-green-700"
                            }`}
                          >
                            {isUpdating
                              ? "Guardando..."
                              : inventoryRow.is_active
                                ? "Retirar de sucursal"
                                : "Reactivar en sucursal"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProductModal({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState("OTROS");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;

    setName(product.name || "");
    setSku(product.sku || "");
    setPrice(String(product.price ?? ""));
    setCost(String(product.cost ?? ""));
    setCategory(product.category || "OTROS");
    setActive(Boolean(product.active));
  }, [product]);

  if (!open || !product) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!product) return;

    const cleanName = name.trim();
    const cleanSku = sku.trim();
    const priceNumber = Number(price);
    const costNumber = Number(cost || 0);

    if (!cleanName) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (!price || Number.isNaN(priceNumber) || priceNumber < 0) {
      alert("Escribe un precio válido.");
      return;
    }

    if (Number.isNaN(costNumber) || costNumber < 0) {
      alert("Escribe un costo válido.");
      return;
    }

    if (active !== product.active) {
      const shouldChangeGlobalStatus = window.confirm(
        active
          ? `¿Deseas reactivar "${product.name}" en el catálogo general? Volverá a estar disponible en las sucursales donde su inventario esté activo.`
          : `¿Deseas desactivar "${product.name}" del catálogo general? Se ocultará en TODAS las sucursales. Para retirarlo solo de una sucursal, cancela y usa "Administrar sucursales".`
      );

      if (!shouldChangeGlobalStatus) return;
    }

    setSaving(true);

    try {
      if (cleanSku && cleanSku !== product.sku) {
        const { data: duplicatedSku, error: duplicatedSkuError } =
          await supabase
            .from("products")
            .select("id, name")
            .eq("sku", cleanSku)
            .neq("id", product.id)
            .maybeSingle();

        if (duplicatedSkuError) {
          throw duplicatedSkuError;
        }

        if (duplicatedSku) {
          alert(
            `Ese SKU ya existe en otro producto: ${duplicatedSku.name}. No se puede duplicar el código de barras.`
          );

          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("products")
        .update({
          name: cleanName,
          sku: cleanSku || null,
          price: round2(priceNumber),
          cost: round2(costNumber),
          category: category || "OTROS",
          active,
        })
        .eq("id", product.id);

      if (error) {
        throw error;
      }

      setSaving(false);
      await onSaved();
    } catch (err: any) {
      console.error("Error updating product:", err);
      alert(err?.message || "No se pudo actualizar el producto.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-xl p-6">
        <h2 className="text-xl font-bold mb-4">Editar producto</h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              SKU / Código
            </label>

            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="border rounded w-full px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Costo</label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="border rounded w-full px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Precio de venta
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="border rounded w-full px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Categoría / Departamento
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded w-full px-3 py-2"
            >
              {CATEGORIES.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />

            <span>Producto activo en el catálogo general</span>
          </label>

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Los cambios de costo, precio, SKU, nombre, categoría y estado activo
            aplican al catálogo general y pueden afectar todas las sucursales.
            Para retirar el producto únicamente de una sucursal, utiliza
            “Administrar sucursales”.
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="border px-4 py-2 rounded disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}