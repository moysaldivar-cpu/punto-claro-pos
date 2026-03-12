import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type InventoryRow = {
  id: string;
  product_id: string;
  stock: number;
  product_name: string;
};

export default function InventoryLoss() {
  const { user } = useAuth();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function loadInventory() {
    if (!user) return;

    const { data, error } = await supabase
      .from("inventory")
      .select("id, product_id, stock, products(name)")
      .eq("store_id", user.store_id)
      .order("stock", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      setRows([]);
      return;
    }

    const mapped: InventoryRow[] = (data as any[]).map((item) => ({
      id: String(item.id),
      product_id: String(item.product_id),
      stock: Number(item.stock || 0),
      product_name: String(item.products?.name || "Producto"),
    }));

    setRows(mapped);
  }

  useEffect(() => {
    loadInventory();
  }, [user]);

  async function registerLoss(row: InventoryRow) {
    const qty = Number(quantities[row.id]);
    const reason = reasons[row.id];

    if (!qty || qty <= 0) {
      alert("Ingresa una cantidad válida");
      return;
    }

    if (qty > row.stock) {
      alert("La merma no puede ser mayor al stock disponible");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("inventory_movements").insert({
      product_id: row.product_id,
      inventory_id: row.id,
      store_id: user?.store_id,
      user_id: user?.id,
      type: "out",
      quantity: -qty,
      reason: reason || "merma",
    });

    setLoading(false);

    if (error) {
      console.error(error);
      alert("Error registrando merma");
      return;
    }

    alert("Merma registrada");

    setQuantities((prev) => ({ ...prev, [row.id]: "" }));
    setReasons((prev) => ({ ...prev, [row.id]: "" }));

    loadInventory();
  }

  return (
    <div className="max-w-6xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Registrar Merma</h1>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Producto</th>
            <th className="p-2">Stock</th>
            <th className="p-2">Cantidad</th>
            <th className="p-2">Motivo</th>
            <th className="p-2">Acción</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-2">{row.product_name}</td>

              <td className="p-2">{row.stock}</td>

              <td className="p-2">
                <input
                  type="number"
                  min="1"
                  value={quantities[row.id] || ""}
                  onChange={(e) =>
                    setQuantities({
                      ...quantities,
                      [row.id]: e.target.value,
                    })
                  }
                  className="border p-1 w-24"
                />
              </td>

              <td className="p-2">
                <input
                  type="text"
                  placeholder="motivo"
                  value={reasons[row.id] || ""}
                  onChange={(e) =>
                    setReasons({
                      ...reasons,
                      [row.id]: e.target.value,
                    })
                  }
                  className="border p-1 w-48"
                />
              </td>

              <td className="p-2">
                <button
                  disabled={loading}
                  onClick={() => registerLoss(row)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Registrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}