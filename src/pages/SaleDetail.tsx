import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
};

type SaleItemView = {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  price: number;
  subtotal: number;
};

export default function SaleDetail() {
  const { role, loadingRole } = useAuth();
  const isAdmin = role === "admin";

  const { saleId } = useParams<{ saleId: string }>();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SaleItemView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && saleId) {
      loadSaleItems();
    }
  }, [isAdmin, saleId]);

  async function loadSaleItems() {
    setLoading(true);
    setError(null);

    const { data: saleItems, error: itemsError } = await supabase
      .from("sales_items")
      .select("id, sale_id, product_id, quantity")
      .eq("sale_id", saleId);

    if (itemsError || !saleItems) {
      setError("No se pudieron cargar los productos de la venta");
      setLoading(false);
      return;
    }

    const productIds = saleItems.map((i: SaleItem) => i.product_id);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, price")
      .in("id", productIds);

    if (productsError || !products) {
      setError("No se pudieron cargar los productos");
      setLoading(false);
      return;
    }

    const merged: SaleItemView[] = saleItems.map((item: SaleItem) => {
      const product = products.find(
        (p: Product) => p.id === item.product_id
      );

      const price = product?.price ?? 0;

      return {
        id: item.id,
        product_name: product?.name ?? "—",
        sku: product?.sku ?? "—",
        quantity: item.quantity,
        price,
        subtotal: price * item.quantity,
      };
    });

    setItems(merged);
    setLoading(false);
  }

  if (loadingRole || loading) {
    return <div className="p-6">Cargando detalle de venta…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-red-600">
        No tienes permiso para ver esta venta.
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">
        Detalle de venta
      </h1>

      <table className="w-full border mb-4">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Producto</th>
            <th className="p-2 text-left">SKU</th>
            <th className="p-2 text-center">Cantidad</th>
            <th className="p-2 text-center">Precio</th>
            <th className="p-2 text-center">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">{item.product_name}</td>
              <td className="p-2">{item.sku}</td>
              <td className="p-2 text-center">{item.quantity}</td>
              <td className="p-2 text-center">${item.price}</td>
              <td className="p-2 text-center font-semibold">
                ${item.subtotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-right font-bold">
        Total: ${total}
      </div>
    </div>
  );
}
