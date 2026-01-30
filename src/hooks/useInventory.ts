import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type InventoryItem = {
  product_id: string;
  store_id: string;
  stock: number;
  min_stock: number;
  product_name: string;
  sku: string;
};

export function useInventory(storeId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setItems([]);
      return;
    }

    const fetchInventory = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          product_id,
          store_id,
          stock,
          min_stock,
          products (
            name,
            sku
          )
        `
        )
        .eq("store_id", storeId);

      if (error) {
        console.error("Error fetching inventory:", error);
        setError("No se pudo cargar el inventario");
        setItems([]);
        setLoading(false);
        return;
      }

      const mapped: InventoryItem[] =
        data?.map((row: any) => ({
          product_id: row.product_id,
          store_id: row.store_id,
          stock: row.stock,
          min_stock: row.min_stock,
          product_name: row.products?.name ?? "",
          sku: row.products?.sku ?? "",
        })) ?? [];

      setItems(mapped);
      setLoading(false);
    };

    fetchInventory();
  }, [storeId]);

  return {
    items,
    loading,
    error,
  };
}
