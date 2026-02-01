import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdjustInventoryModal from "@/components/AdjustInventoryModal";
import MoveInventoryModal, {
  MoveMode,
} from "@/components/MoveInventoryModal";

type InventoryRow = {
  id: string;
  product_id: string;
  stock: number;
  min_stock: number;
  product_name: string;
};

export default function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // I3 – ajuste absoluto (existente, NO TOCAR)
  const [selectedAdjust, setSelectedAdjust] =
    useState<InventoryRow | null>(null);

  // I5 – entrada / salida (nuevo)
  const [selectedMove, setSelectedMove] =
    useState<InventoryRow | null>(null);
  const [moveMode, setMoveMode] = useState<MoveMode>("in");

  const storeId = localStorage.getItem("store_id") || "";

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);

    const { data, error } = await supabase
      .from("inventory")
      .select(
        `
        id,
        product_id,
        stock,
        min_stock,
        products!inner (
          name
        )
      `
      )
      .order("products(name)");

    if (error) {
      console.error("Error loading inventory:", error);
      setRows([]);
    } else {
      const mapped =
        (data ?? []).map((r: any) => ({
          id: r.id,
          product_id: r.product_id,
          stock: r.stock,
          min_stock: r.min_stock,
          product_name: r.products?.name ?? "(Sin nombre)",
        })) ?? [];
      setRows(mapped);
    }

    setLoading(false);
  }

  // I5 – llamada RPC delta (+ / -)
  async function handleMoveConfirm(payload: {
    delta: number;
    reason: string;
  }) {
    if (!selectedMove) return;

    const { error } = await supabase.rpc("move_inventory", {
      p_inventory_id: selectedMove.id,
      p_product_id: selectedMove.product_id,
      p_store_id: storeId,
      p_delta: payload.delta,
      p_reason: payload.reason,
    });

    if (error) {
      console.error("Error move_inventory:", error);
      throw error;
    }

    await loadInventory();
  }

  if (loading) {
    return <div>Cargando inventario…</div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Inventario</h1>

      <table className="w-full border">
        <thead className="bg-gray-100 text-left">
          <tr>
            <th className="p-2">Producto</th>
            <th className="p-2">Stock</th>
            <th className="p-2">Mínimo</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.product_name}</td>
              <td className="p-2">{r.stock}</td>
              <td className="p-2">{r.min_stock}</td>
              <td className="p-2 flex gap-3">
                {/* I5 – Entrada */}
                <button
                  className="text-green-700 underline text-sm"
                  onClick={() => {
                    setSelectedMove(r);
                    setMoveMode("in");
                  }}
                >
                  Entrada
                </button>

                {/* I5 – Salida */}
                <button
                  className="text-red-700 underline text-sm"
                  onClick={() => {
                    setSelectedMove(r);
                    setMoveMode("out");
                  }}
                >
                  Salida
                </button>

                {/* I3 – Ajuste absoluto (existente) */}
                <button
                  onClick={() => setSelectedAdjust(r)}
                  className="text-blue-600 underline text-sm"
                >
                  Ajustar inventario
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* I3 – Ajuste absoluto (NO TOCAR) */}
      <AdjustInventoryModal
        open={!!selectedAdjust}
        inventoryId={selectedAdjust?.id ?? ""}
        productId={selectedAdjust?.product_id ?? ""}
        storeId={storeId}
        currentStock={selectedAdjust?.stock ?? 0}
        productName={selectedAdjust?.product_name ?? ""}
        onClose={() => setSelectedAdjust(null)}
        onSaved={loadInventory}
      />

      {/* I5 – Entrada / Salida (nuevo) */}
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
