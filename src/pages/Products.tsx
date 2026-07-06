import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
        .select("id, stock")
        .eq("product_id", product.id)
        .eq("store_id", storeId)
        .maybeSingle();

    if (existingInventoryError) {
      console.error("Error checking inventory:", existingInventoryError);
      throw existingInventoryError;
    }

    if (existingInventory) {
      const currentStock = Number(existingInventory.stock || 0);

      const shouldReplace = window.confirm(
        `Este producto ya está asignado a esta sucursal con stock ${currentStock}. ¿Deseas reemplazarlo por stock ${stock}?`
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
        .update({ stock })
        .eq("id", existingInventory.id);

      if (updateInventoryError) {
        console.error("Error updating inventory:", updateInventoryError);
        throw updateInventoryError;
      }

      return {
        assigned: true,
        updated: true,
        message: `Producto actualizado en la sucursal con stock ${stock}.`,
      };
    }

    const { error: insertInventoryError } = await supabase
      .from("inventory")
      .insert({
        product_id: product.id,
        store_id: storeId,
        stock,
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
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  function goToInventory() {
    navigate("/inventory");
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
                <th className="border p-2">Activo</th>
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
                          onClick={goToInventory}
                          className="text-sm underline"
                        >
                          Asignar inventario
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
          Nota: el SKU o código de barras es único en el catálogo. Para tener el
          mismo producto en varias sucursales, asígnalo a la sucursal
          correspondiente desde el alta o desde inventario.
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
            <span>Producto activo</span>
          </label>

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Los cambios de costo, precio, SKU, nombre y categoría aplican al
            catálogo general del producto.
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