import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type PromoType = "simple" | "six" | "combo";

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  active: boolean;
};

type PromotionProduct = {
  id: string;
  product_id: string;
  required_units: number;
  product_name: string;
  product_sku: string | null;
  product_active: boolean;
};

type Promotion = {
  id: string;
  name: string;
  promo_type: PromoType;
  required_quantity: number;
  promo_price: number;
  active: boolean;
  applies_all_days: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  products: PromotionProduct[];
};

type PromotionDbRow = {
  id: string;
  name: string;
  promo_type: string;
  required_quantity: number;
  promo_price: number;
  active: boolean;
  applies_all_days: boolean;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
};

type PromotionProductDbRow = {
  id: string;
  promotion_id: string;
  product_id: string;
  required_units: number;
};

type ProductSelection = {
  product_id: string;
  required_units: string;
};

const PROMO_TYPES: { value: PromoType; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "six", label: "Six / paquete" },
  { value: "combo", label: "Combo" },
];

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function formatTimeForInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function promoTypeLabel(value: PromoType) {
  const option = PROMO_TYPES.find((type) => type.value === value);
  return option?.label || value;
}

function isPromoType(value: string): value is PromoType {
  return PROMO_TYPES.some((type) => type.value === value);
}

function emptyProductSelection(): ProductSelection {
  return {
    product_id: "",
    required_units: "1",
  };
}

function validatePromotionForm({
  name,
  promoType,
  requiredQuantity,
  promoPrice,
  appliesAllDays,
  startTime,
  endTime,
  products,
}: {
  name: string;
  promoType: string;
  requiredQuantity: string;
  promoPrice: string;
  appliesAllDays: boolean;
  startTime: string;
  endTime: string;
  products: ProductSelection[];
}) {
  const cleanName = name.trim();
  const requiredQuantityNumber = Number(requiredQuantity);
  const promoPriceNumber = Number(promoPrice);

  if (!cleanName) {
    return "Escribe el nombre de la promoción.";
  }

  if (!isPromoType(promoType)) {
    return "Selecciona un tipo de promoción válido.";
  }

  if (
    !requiredQuantity ||
    Number.isNaN(requiredQuantityNumber) ||
    requiredQuantityNumber <= 0 ||
    !Number.isInteger(requiredQuantityNumber)
  ) {
    return "Escribe una cantidad requerida válida.";
  }

  if (!promoPrice || Number.isNaN(promoPriceNumber) || promoPriceNumber <= 0) {
    return "Escribe un precio de promoción válido.";
  }

  if (!appliesAllDays && (!startTime || !endTime)) {
    return "Si la promoción no aplica todo el día, captura hora inicio y hora fin.";
  }

  if (products.length === 0) {
    return "Agrega al menos un producto a la promoción.";
  }

  const cleanProductIds = products.map((row) => row.product_id).filter(Boolean);

  if (cleanProductIds.length !== products.length) {
    return "Todas las filas de productos deben tener un producto seleccionado.";
  }

  const duplicatedProduct = cleanProductIds.find(
    (productId, index) => cleanProductIds.indexOf(productId) !== index
  );

  if (duplicatedProduct) {
    return "No repitas el mismo producto dentro de la promoción.";
  }

  const requiredUnits = products.map((row) => Number(row.required_units));

  if (
    requiredUnits.some(
      (units) => Number.isNaN(units) || units <= 0 || !Number.isInteger(units)
    )
  ) {
    return "Las unidades requeridas por producto deben ser números enteros mayores a 0.";
  }

  const totalRequiredUnits = requiredUnits.reduce((acc, units) => acc + units, 0);

  if (totalRequiredUnits !== requiredQuantityNumber) {
    return `La suma de unidades por producto (${totalRequiredUnits}) debe coincidir con la cantidad requerida (${requiredQuantityNumber}).`;
  }

  return "";
}

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const [newName, setNewName] = useState("");
  const [newPromoType, setNewPromoType] = useState<PromoType>("six");
  const [newRequiredQuantity, setNewRequiredQuantity] = useState("6");
  const [newPromoPrice, setNewPromoPrice] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [newAppliesAllDay, setNewAppliesAllDay] = useState(true);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newProductSelections, setNewProductSelections] = useState<ProductSelection[]>([
    { product_id: "", required_units: "6" },
  ]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [activeFilter, setActiveFilter] = useState("todos");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [
      { data: promotionRows, error: promotionError },
      { data: promotionProductRows, error: promotionProductError },
      { data: productRows, error: productError },
    ] = await Promise.all([
      supabase
        .from("promotions")
        .select(
          "id, name, promo_type, required_quantity, promo_price, active, applies_all_days, start_time, end_time, notes"
        )
        .order("name", { ascending: true }),
      supabase
        .from("promotion_products")
        .select("id, promotion_id, product_id, required_units")
        .order("created_at", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, sku, active")
        .order("name", { ascending: true }),
    ]);

    if (promotionError) {
      console.error("Error loading promotions:", promotionError);
      alert("No se pudieron cargar las promociones.");
      setPromotions([]);
      setLoading(false);
      return;
    }

    if (promotionProductError) {
      console.error("Error loading promotion products:", promotionProductError);
      alert("No se pudieron cargar los productos de promociones.");
      setPromotions([]);
      setLoading(false);
      return;
    }

    if (productError) {
      console.error("Error loading products:", productError);
      alert("No se pudieron cargar los productos.");
      setProducts([]);
      setLoading(false);
      return;
    }

    const mappedProducts: ProductOption[] = ((productRows || []) as any[]).map(
      (product) => ({
        id: String(product.id),
        name: String(product.name || "Producto"),
        sku: product.sku ? String(product.sku) : null,
        active: Boolean(product.active),
      })
    );

    const productMap = new Map<string, ProductOption>(
      mappedProducts.map((product) => [product.id, product])
    );

    const productRowsByPromotion = new Map<string, PromotionProduct[]>();

    ((promotionProductRows || []) as PromotionProductDbRow[]).forEach((row) => {
      const product = productMap.get(String(row.product_id));
      const promotionId = String(row.promotion_id);

      const list = productRowsByPromotion.get(promotionId) || [];

      list.push({
        id: String(row.id),
        product_id: String(row.product_id),
        required_units: Number(row.required_units || 0),
        product_name: product?.name || "Producto no encontrado",
        product_sku: product?.sku || null,
        product_active: Boolean(product?.active),
      });

      productRowsByPromotion.set(promotionId, list);
    });

    const mappedPromotions: Promotion[] = ((promotionRows || []) as PromotionDbRow[]).map(
      (promotion) => {
        const rawPromoType = String(promotion.promo_type);
        const promoType: PromoType = isPromoType(rawPromoType)
          ? rawPromoType
          : "simple";

        return {
          id: String(promotion.id),
          name: String(promotion.name || "Promoción"),
          promo_type: promoType,
          required_quantity: Number(promotion.required_quantity || 0),
          promo_price: Number(promotion.promo_price || 0),
          active: Boolean(promotion.active),
          applies_all_days: Boolean(promotion.applies_all_days),
          start_time: promotion.start_time,
          end_time: promotion.end_time,
          notes: promotion.notes,
          products: productRowsByPromotion.get(String(promotion.id)) || [],
        };
      }
    );

    setProducts(mappedProducts);
    setPromotions(mappedPromotions);
    setLoading(false);
  }

  const filteredPromotions = useMemo(() => {
    let list = [...promotions];

    const term = normalizeText(search);

    if (term) {
      list = list.filter((promotion) => {
        const promotionText = normalizeText(
          `${promotion.name} ${promotion.notes || ""}`
        );

        const productText = normalizeText(
          promotion.products
            .map((product) => `${product.product_name} ${product.product_sku || ""}`)
            .join(" ")
        );

        return promotionText.includes(term) || productText.includes(term);
      });
    }

    if (typeFilter !== "todos") {
      list = list.filter((promotion) => promotion.promo_type === typeFilter);
    }

    if (activeFilter === "activas") {
      list = list.filter((promotion) => promotion.active);
    }

    if (activeFilter === "inactivas") {
      list = list.filter((promotion) => !promotion.active);
    }

    return list;
  }, [promotions, search, typeFilter, activeFilter]);

  function resetCreateForm() {
    setNewName("");
    setNewPromoType("six");
    setNewRequiredQuantity("6");
    setNewPromoPrice("");
    setNewActive(true);
    setNewAppliesAllDay(true);
    setNewStartTime("");
    setNewEndTime("");
    setNewNotes("");
    setNewProductSelections([{ product_id: "", required_units: "6" }]);
    setShowCreateForm(false);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("todos");
    setActiveFilter("todos");
  }

  function handleNewPromoTypeChange(value: PromoType) {
    setNewPromoType(value);

    if (value === "six") {
      setNewRequiredQuantity("6");
      setNewProductSelections([{ product_id: "", required_units: "6" }]);
      return;
    }

    if (value === "combo") {
      setNewRequiredQuantity("2");
      setNewProductSelections([
        { product_id: "", required_units: "1" },
        { product_id: "", required_units: "1" },
      ]);
      return;
    }

    setNewRequiredQuantity("2");
    setNewProductSelections([{ product_id: "", required_units: "2" }]);
  }

  function updateNewProductSelection(
    index: number,
    field: keyof ProductSelection,
    value: string
  ) {
    setNewProductSelections((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function addNewProductSelection() {
    setNewProductSelections((current) => [...current, emptyProductSelection()]);
  }

  function removeNewProductSelection(index: number) {
    setNewProductSelections((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);

      if (next.length === 0) {
        return [emptyProductSelection()];
      }

      return next;
    });
  }

  async function createPromotion(e: FormEvent) {
    e.preventDefault();

    const validationMessage = validatePromotionForm({
      name: newName,
      promoType: newPromoType,
      requiredQuantity: newRequiredQuantity,
      promoPrice: newPromoPrice,
      appliesAllDays: newAppliesAllDay,
      startTime: newStartTime,
      endTime: newEndTime,
      products: newProductSelections,
    });

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const now = new Date().toISOString();

    setSaving(true);

    try {
      const { data: createdPromotion, error: createPromotionError } =
        await supabase
          .from("promotions")
          .insert({
            name: newName.trim(),
            promo_type: newPromoType,
            required_quantity: Number(newRequiredQuantity),
            promo_price: round2(Number(newPromoPrice)),
            active: newActive,
            applies_all_days: newAppliesAllDay,
            start_time: newAppliesAllDay ? null : newStartTime,
            end_time: newAppliesAllDay ? null : newEndTime,
            notes: newNotes.trim() || null,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();

      if (createPromotionError || !createdPromotion) {
        throw createPromotionError || new Error("No se pudo crear la promoción.");
      }

      const promotionProductRows = newProductSelections.map((row) => ({
        promotion_id: createdPromotion.id,
        product_id: row.product_id,
        required_units: Number(row.required_units),
        created_at: now,
      }));

      const { error: createProductsError } = await supabase
        .from("promotion_products")
        .insert(promotionProductRows);

      if (createProductsError) {
        throw createProductsError;
      }

      alert("Promoción creada correctamente.");

      resetCreateForm();
      await loadData();
    } catch (err: any) {
      console.error("Error creating promotion:", err);
      alert(err?.message || "No se pudo guardar la promoción.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promotion: Promotion) {
    const { error } = await supabase
      .from("promotions")
      .update({
        active: !promotion.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", promotion.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  if (loading) {
    return <div>Cargando promociones…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Promociones</h1>
            <p className="text-gray-600 mt-1">
              Administra las promociones del POS. Los productos incluidos y sus
              unidades requeridas deben coincidir con la cantidad total de la promoción.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((value) => !value)}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            {showCreateForm ? "Cancelar" : "Agregar promoción"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">Nueva promoción</h2>

          <form onSubmit={createPromotion} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Nombre de la promoción
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. CORONA EXTRA 6X110"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={newPromoType}
                  onChange={(e) => handleNewPromoTypeChange(e.target.value as PromoType)}
                  className="w-full border rounded px-3 py-2"
                >
                  {PROMO_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Cantidad requerida
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newRequiredQuantity}
                  onChange={(e) => setNewRequiredQuantity(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Precio promo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPromoPrice}
                  onChange={(e) => setNewPromoPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <label className="flex items-center gap-2 border rounded px-3 py-2">
                  <input
                    type="checkbox"
                    checked={newActive}
                    onChange={(e) => setNewActive(e.target.checked)}
                  />
                  <span>{newActive ? "Activa" : "Inactiva"}</span>
                </label>
              </div>
            </div>

            <div className="border rounded p-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                <div>
                  <h3 className="font-semibold">Productos incluidos</h3>
                  <p className="text-sm text-gray-500">
                    La suma de unidades requeridas debe coincidir con la cantidad
                    requerida de la promoción.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addNewProductSelection}
                  className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
                >
                  Agregar producto
                </button>
              </div>

              <div className="space-y-3">
                {newProductSelections.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-8">
                      <label className="block text-sm font-medium mb-1">
                        Producto
                      </label>
                      <select
                        value={row.product_id}
                        onChange={(e) =>
                          updateNewProductSelection(index, "product_id", e.target.value)
                        }
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">Selecciona producto</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                            {product.sku ? ` — ${product.sku}` : ""}
                            {!product.active ? " (inactivo)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        Unidades
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.required_units}
                        onChange={(e) =>
                          updateNewProductSelection(
                            index,
                            "required_units",
                            e.target.value
                          )
                        }
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => removeNewProductSelection(index)}
                        className="w-full border px-3 py-2 rounded hover:bg-gray-50"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 border rounded px-3 py-2">
                  <input
                    type="checkbox"
                    checked={newAppliesAllDay}
                    onChange={(e) => setNewAppliesAllDay(e.target.checked)}
                  />
                  <span>Aplica todo el día</span>
                </label>
              </div>

              {!newAppliesAllDay && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Hora inicio
                    </label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Hora fin
                    </label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-6">
                <label className="block text-sm font-medium mb-1">Notas</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ej. Promoción six, misil, mega..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Recomendación: para six usa 1 producto con 6 unidades; para combo usa
              productos diferentes cuya suma sea la cantidad requerida.
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar promoción"}
              </button>

              <button
                type="button"
                onClick={resetCreateForm}
                disabled={saving}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-60"
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
              Buscar promoción o producto
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ej. corona, tecate, misil, six..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="todos">Todos</option>
              {PROMO_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
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
              <option value="todos">Todas</option>
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
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
            Mostrando <strong>{filteredPromotions.length}</strong> de{" "}
            <strong>{promotions.length}</strong> promociones.
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Promociones registradas</h2>

        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="border p-2">Promoción</th>
                <th className="border p-2">Tipo</th>
                <th className="border p-2">Cantidad</th>
                <th className="border p-2">Precio promo</th>
                <th className="border p-2">Productos</th>
                <th className="border p-2">Horario</th>
                <th className="border p-2">Activa</th>
                <th className="border p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredPromotions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No hay promociones que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {filteredPromotions.map((promotion) => (
                <tr
                  key={promotion.id}
                  className={`border-t hover:bg-gray-50 ${
                    !promotion.active ? "bg-red-50" : ""
                  }`}
                >
                  <td className="border p-2 font-medium">
                    {promotion.name}
                    {promotion.notes && (
                      <div className="text-xs text-gray-500 mt-1">
                        {promotion.notes}
                      </div>
                    )}
                  </td>

                  <td className="border p-2">{promoTypeLabel(promotion.promo_type)}</td>

                  <td className="border p-2 text-center">
                    {promotion.required_quantity}
                  </td>

                  <td className="border p-2">${promotion.promo_price.toFixed(2)}</td>

                  <td className="border p-2">
                    {promotion.products.length === 0 ? (
                      <span className="text-red-600 font-semibold">
                        Sin productos ligados
                      </span>
                    ) : (
                      <div className="space-y-1">
                        {promotion.products.map((product) => (
                          <div key={product.id}>
                            <span className="font-medium">
                              {product.product_name}
                            </span>{" "}
                            <span className="text-gray-500">
                              x {product.required_units}
                              {product.product_sku
                                ? ` — ${product.product_sku}`
                                : ""}
                              {!product.product_active ? " — inactivo" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="border p-2">
                    {promotion.applies_all_days ? (
                      "Todo el día"
                    ) : (
                      <>
                        {formatTimeForInput(promotion.start_time)} -{" "}
                        {formatTimeForInput(promotion.end_time)}
                      </>
                    )}
                  </td>

                  <td className="border p-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={promotion.active}
                        onChange={() => toggleActive(promotion)}
                      />
                      <span>{promotion.active ? "Sí" : "No"}</span>
                    </label>
                  </td>

                  <td className="border p-2">
                    <button
                      type="button"
                      onClick={() => setEditingPromotion(promotion)}
                      className="text-blue-600 underline text-sm"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Nota: no se eliminan promociones desde este módulo; para dejar de usarlas,
          desactívalas.
        </p>
      </div>

      <EditPromotionModal
        open={!!editingPromotion}
        promotion={editingPromotion}
        products={products}
        onClose={() => setEditingPromotion(null)}
        onSaved={async () => {
          setEditingPromotion(null);
          await loadData();
        }}
      />
    </div>
  );
}

function EditPromotionModal({
  open,
  promotion,
  products,
  onClose,
  onSaved,
}: {
  open: boolean;
  promotion: Promotion | null;
  products: ProductOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [promoType, setPromoType] = useState<PromoType>("six");
  const [requiredQuantity, setRequiredQuantity] = useState("6");
  const [promoPrice, setPromoPrice] = useState("");
  const [active, setActive] = useState(true);
  const [appliesAllDay, setAppliesAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [productSelections, setProductSelections] = useState<ProductSelection[]>([
    emptyProductSelection(),
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!promotion) return;

    setName(promotion.name || "");
    setPromoType(promotion.promo_type || "six");
    setRequiredQuantity(String(promotion.required_quantity || ""));
    setPromoPrice(String(promotion.promo_price || ""));
    setActive(Boolean(promotion.active));
    setAppliesAllDay(Boolean(promotion.applies_all_days));
    setStartTime(formatTimeForInput(promotion.start_time));
    setEndTime(formatTimeForInput(promotion.end_time));
    setNotes(promotion.notes || "");

    if (promotion.products.length > 0) {
      setProductSelections(
        promotion.products.map((product) => ({
          product_id: product.product_id,
          required_units: String(product.required_units || 1),
        }))
      );
    } else {
      setProductSelections([emptyProductSelection()]);
    }
  }, [promotion]);

  if (!open || !promotion) return null;

  function updateProductSelection(
    index: number,
    field: keyof ProductSelection,
    value: string
  ) {
    setProductSelections((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function addProductSelection() {
    setProductSelections((current) => [...current, emptyProductSelection()]);
  }

  function removeProductSelection(index: number) {
    setProductSelections((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);

      if (next.length === 0) {
        return [emptyProductSelection()];
      }

      return next;
    });
  }

  function handlePromoTypeChange(value: PromoType) {
    setPromoType(value);

    if (value === "six") {
      setRequiredQuantity("6");
      setProductSelections([{ product_id: "", required_units: "6" }]);
      return;
    }

    if (value === "combo") {
      setRequiredQuantity("2");
      setProductSelections([
        { product_id: "", required_units: "1" },
        { product_id: "", required_units: "1" },
      ]);
      return;
    }

    setRequiredQuantity("2");
    setProductSelections([{ product_id: "", required_units: "2" }]);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();

    if (!promotion) return;

    const promotionId = promotion.id;

    const validationMessage = validatePromotionForm({
      name,
      promoType,
      requiredQuantity,
      promoPrice,
      appliesAllDays: appliesAllDay,
      startTime,
      endTime,
      products: productSelections,
    });

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const now = new Date().toISOString();

    setSaving(true);

    try {
      const { error: updatePromotionError } = await supabase
        .from("promotions")
        .update({
          name: name.trim(),
          promo_type: promoType,
          required_quantity: Number(requiredQuantity),
          promo_price: round2(Number(promoPrice)),
          active,
          applies_all_days: appliesAllDay,
          start_time: appliesAllDay ? null : startTime,
          end_time: appliesAllDay ? null : endTime,
          notes: notes.trim() || null,
          updated_at: now,
        })
        .eq("id", promotionId);

      if (updatePromotionError) {
        throw updatePromotionError;
      }

      const { error: deleteProductsError } = await supabase
        .from("promotion_products")
        .delete()
        .eq("promotion_id", promotionId);

      if (deleteProductsError) {
        throw deleteProductsError;
      }

      const promotionProductRows = productSelections.map((row) => ({
        promotion_id: promotionId,
        product_id: row.product_id,
        required_units: Number(row.required_units),
        created_at: now,
      }));

      const { error: insertProductsError } = await supabase
        .from("promotion_products")
        .insert(promotionProductRows);

      if (insertProductsError) {
        throw insertProductsError;
      }

      alert("Promoción actualizada correctamente.");

      await onSaved();
    } catch (err: any) {
      console.error("Error updating promotion:", err);
      alert(err?.message || "No se pudo actualizar la promoción.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Editar promoción</h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Nombre de la promoción
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={promoType}
                onChange={(e) => handlePromoTypeChange(e.target.value as PromoType)}
                className="w-full border rounded px-3 py-2"
              >
                {PROMO_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cantidad requerida
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={requiredQuantity}
                onChange={(e) => setRequiredQuantity(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Precio promo
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={promoPrice}
                onChange={(e) => setPromoPrice(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <label className="flex items-center gap-2 border rounded px-3 py-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>{active ? "Activa" : "Inactiva"}</span>
              </label>
            </div>
          </div>

          <div className="border rounded p-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
              <div>
                <h3 className="font-semibold">Productos incluidos</h3>
                <p className="text-sm text-gray-500">
                  La suma de unidades requeridas debe coincidir con la cantidad
                  requerida.
                </p>
              </div>

              <button
                type="button"
                onClick={addProductSelection}
                className="bg-gray-200 px-3 py-2 rounded hover:bg-gray-300"
              >
                Agregar producto
              </button>
            </div>

            <div className="space-y-3">
              {productSelections.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <div className="md:col-span-8">
                    <label className="block text-sm font-medium mb-1">
                      Producto
                    </label>
                    <select
                      value={row.product_id}
                      onChange={(e) =>
                        updateProductSelection(index, "product_id", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Selecciona producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` — ${product.sku}` : ""}
                          {!product.active ? " (inactivo)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Unidades
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.required_units}
                      onChange={(e) =>
                        updateProductSelection(
                          index,
                          "required_units",
                          e.target.value
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeProductSelection(index)}
                      className="w-full border px-3 py-2 rounded hover:bg-gray-50"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 border rounded px-3 py-2">
                <input
                  type="checkbox"
                  checked={appliesAllDay}
                  onChange={(e) => setAppliesAllDay(e.target.checked)}
                />
                <span>Aplica todo el día</span>
              </label>
            </div>

            {!appliesAllDay && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Hora inicio
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Hora fin
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-6">
              <label className="block text-sm font-medium mb-1">Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            Cambiar tipo reinicia la selección de productos sugerida para evitar
            combinaciones inválidas.
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