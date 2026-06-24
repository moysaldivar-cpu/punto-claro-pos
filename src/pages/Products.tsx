import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  category: string;
  active: boolean;
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

export default function Products() {
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSku, setNewSku] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("OTROS");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [activeFilter, setActiveFilter] = useState("todos");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, price, category, active")
      .order("name");

    if (error) {
      console.error("Error loading products:", error);
      alert("No se pudieron cargar los productos.");
      setProducts([]);
    } else {
      setProducts(
        (data ?? []).map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: Number(product.price || 0),
          category: String(product.category || "OTROS"),
          active: Boolean(product.active),
        }))
      );
    }

    setLoading(false);
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
    setNewCategory("OTROS");
    setShowCreateForm(false);
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("TODAS");
    setActiveFilter("todos");
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = newName.trim();
    const cleanSku = newSku.trim();
    const priceNumber = Number(newPrice);

    if (!cleanName) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (!newPrice || Number.isNaN(priceNumber) || priceNumber < 0) {
      alert("Escribe un precio válido.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("products").insert({
      name: cleanName,
      sku: cleanSku || null,
      price: priceNumber,
      category: newCategory || "OTROS",
      active: true,
    });

    if (error) {
      console.error("Error creating product:", error);
      alert(error.message);
      setSaving(false);
      return;
    }

    resetCreateForm();
    await loadProducts();
    setSaving(false);
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
              Administra el catálogo de productos. El SKU o código de barras es
              el dato que usa el lector para encontrar productos en el POS.
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
          <h2 className="text-lg font-semibold mb-4">Nuevo producto</h2>

          <form
            onSubmit={createProduct}
            className="grid grid-cols-1 md:grid-cols-5 gap-4"
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
              <label className="block text-sm font-medium mb-1">
                Categoría
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

            <div className="md:col-span-5 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Crear producto"}
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
            <label className="block text-sm font-medium mb-1">Categoría</label>
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
                <th className="border p-2">Precio</th>
                <th className="border p-2">Activo</th>
                <th className="border p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No hay productos que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {filteredProducts.map((p) => (
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

                  <td className="border p-2">${p.price.toFixed(2)}</td>

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
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Nota: para que el lector de códigos funcione, el producto debe tener
          capturado su SKU o código de barras.
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
  const [category, setCategory] = useState("OTROS");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;

    setName(product.name || "");
    setSku(product.sku || "");
    setPrice(String(product.price ?? ""));
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

    if (!cleanName) {
      alert("Escribe el nombre del producto.");
      return;
    }

    if (!price || Number.isNaN(priceNumber) || priceNumber < 0) {
      alert("Escribe un precio válido.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("products")
      .update({
        name: cleanName,
        sku: cleanSku || null,
        price: priceNumber,
        category: category || "OTROS",
        active,
      })
      .eq("id", product.id);

    if (error) {
      console.error("Error updating product:", error);
      alert(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await onSaved();
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

          <div>
            <label className="block text-sm font-medium mb-1">Precio</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border rounded w-full px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoría</label>
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