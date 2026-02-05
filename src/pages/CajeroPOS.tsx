import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PaymentModal from "@/components/PaymentModal";
import { usePosAuth } from "@/contexts/AuthContext";

type ProductRow = {
  product_id: string;
  stock: number;
  name: string;
  price: number;
};

type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

export default function CajeroPOS() {
  const { user } = usePosAuth();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [total, setTotal] = useState(0);

  // 🔥 AQUÍ ESTÁ LA CLAVE: el store viene del usuario autenticado
  const storeId = user?.store_id;

  useEffect(() => {
    if (storeId) {
      loadProducts();
    }
  }, [storeId]);

  useEffect(() => {
    const t = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    setTotal(t);
  }, [cart]);

  async function loadProducts() {
    if (!storeId) return;

    const { data: inv } = await supabase
      .from("inventory")
      .select("product_id, stock")
      .eq("store_id", storeId);

    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price");

    if (!inv || !prods) {
      setProducts([]);
      return;
    }

    const merged: ProductRow[] = inv.map((i) => {
      const p = prods.find((x) => x.id === i.product_id);

      return {
        product_id: i.product_id,
        stock: i.stock,
        name: p?.name || "Sin nombre",
        price: p?.price || 0,
      };
    });

    setProducts(merged);
  }

  function addToCart(p: ProductRow) {
    if (p.stock <= 0) {
      alert("Producto sin stock");
      return;
    }

    setCart((prev) => {
      const exist = prev.find((x) => x.product_id === p.product_id);

      if (exist) {
        return prev.map((x) =>
          x.product_id === p.product_id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [
        ...prev,
        {
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          quantity: 1,
        },
      ];
    });
  }

  function removeOne(product_id: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === product_id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
  }

  async function handleConfirmPayment(payload: {
    payment_method: "cash" | "card" | "mixed";
    payment_cash: number;
    payment_card: number;
  }) {
    if (!storeId) {
      alert("No hay sucursal definida");
      return;
    }

    try {
      const { data: saleId, error } = await supabase.rpc(
        "create_sale_with_cash_register",
        {
          p_store_id: storeId,
          p_subtotal: total,
          p_tax: 0,
          p_total: total,
          p_payment_method: payload.payment_method,
          p_user_name: user?.nombre || "Cajero",
          p_payment_cash: payload.payment_cash,
          p_payment_card: payload.payment_card,
          p_payment_usd: 0,
          p_folio: "AUTO",
        }
      );

      if (error) throw error;

      for (const item of cart) {
        await supabase.from("sales_items").insert({
          sale_id: saleId,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        });

        await supabase.rpc("force_discount", {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
          p_store_id: storeId,
        });
      }

      alert("Venta registrada correctamente");

      setIsPaymentOpen(false);
      setCart([]);

      await loadProducts();

    } catch (e: any) {
      alert("Error al guardar venta: " + e.message);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        Punto de Venta – {user?.nombre}
      </h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {products.map((p) => (
            <button
              key={p.product_id}
              className="border p-3 text-left"
              onClick={() => addToCart(p)}
            >
              <div className="font-semibold">
                {p.name} – ${p.price}
              </div>

              <div className="text-sm text-gray-600">
                Stock: {p.stock}
              </div>
            </button>
          ))}
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-bold mb-2">Carrito</h2>

          {cart.map((c) => (
            <div
              key={c.product_id}
              className="flex justify-between items-center mb-1"
            >
              <span>
                {c.name} x {c.quantity}
              </span>

              <button
                className="text-red-600 font-bold px-2"
                onClick={() => removeOne(c.product_id)}
              >
                -
              </button>
            </div>
          ))}

          <div className="mt-2 font-bold">Total: ${total}</div>

          <button
            className="bg-blue-500 text-white px-4 py-2 mt-2 w-full"
            onClick={() => setIsPaymentOpen(true)}
          >
            Cobrar
          </button>

          {cart.length > 0 && (
            <button
              className="bg-red-500 text-white px-4 py-2 mt-2 w-full"
              onClick={clearCart}
            >
              Vaciar carrito
            </button>
          )}
        </div>
      </div>

      <PaymentModal
        open={isPaymentOpen}
        total={total}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
      />
    </div>
  );
}
