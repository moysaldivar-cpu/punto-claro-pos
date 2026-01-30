import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PaymentModal from "@/components/PaymentModal";
import { useAppSettings } from "@/hooks/useAppSettings";

type ProductRow = {
  product_id: string;
  stock: number;
  min_stock: number;
  name: string;
  price: number; // precio base MXN
};

type CartItem = {
  product_id: string;
  name: string;
  price: number; // precio efectivo (puede incluir horario)
  base_price: number; // precio base para referencia
  quantity: number;
  hasSpecialPrice: boolean;
};

export default function CajeroPOS() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const storeId = localStorage.getItem("store_id");
  const { settings } = useAppSettings();

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const newTotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    setTotal(newTotal);
  }, [cart]);

  async function loadProducts() {
    if (!storeId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("inventory")
      .select(
        `
        product_id,
        stock,
        min_stock,
        products!inner (
          name,
          price
        )
      `
      )
      .eq("store_id", storeId);

    if (error) {
      console.error("Error loading products:", error);
      setLoading(false);
      return;
    }

    const mapped: ProductRow[] =
      data?.map((row: any) => ({
        product_id: row.product_id,
        stock: row.stock,
        min_stock: row.min_stock,
        name: row.products.name,
        price: row.products.price,
      })) ?? [];

    setProducts(mapped);
    setLoading(false);
  }

  // 🔹 Determina si el horario especial está activo
  function isSpecialPricingActive(): {
    active: boolean;
    multiplier: number;
  } {
    const sp = settings.specialPricing;
    if (!sp || !sp.enabled) return { active: false, multiplier: 1 };

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = sp.start.split(":").map(Number);
    const [eh, em] = sp.end.split(":").map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    const active =
      startMinutes <= endMinutes
        ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
        : nowMinutes >= startMinutes || nowMinutes <= endMinutes;

    return { active, multiplier: sp.multiplier };
  }

  function addToCart(product: ProductRow) {
    if (product.stock <= 0) return;

    const { active, multiplier } = isSpecialPricingActive();
    const effectivePrice = active
      ? Number((product.price * multiplier).toFixed(2))
      : product.price;

    setCart((prev) => {
      const existing = prev.find(
        (i) => i.product_id === product.product_id
      );

      if (existing) {
        return prev.map((i) =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }

      return [
        ...prev,
        {
          product_id: product.product_id,
          name: product.name,
          base_price: product.price,
          price: effectivePrice,
          quantity: 1,
          hasSpecialPrice: active,
        },
      ];
    });
  }

  async function handleConfirmPayment(payload: {
    payment_method: "cash" | "card" | "mixed";
    payment_cash: number;
    payment_card: number;
  }) {
    if (!storeId) return;

    const itemsPayload = cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    }));

    const { error } = await supabase.rpc("create_sale_with_items", {
      p_store_id: storeId,
      p_user_name: "Cajero",
      p_items: itemsPayload,
      p_payment_method: payload.payment_method,
      p_payment_cash: payload.payment_cash,
      p_payment_card: payload.payment_card,
      p_payment_usd: 0,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setCart([]);
    setIsPaymentOpen(false);
    await loadProducts();
  }

  if (loading) {
    return <div className="p-6">Cargando productos…</div>;
  }

  const usdRate = settings.usdExchangeRate;
  const totalUsd =
    usdRate && usdRate > 0 ? total / usdRate : null;

  return (
    <div className="p-6 grid grid-cols-3 gap-6">
      {/* Productos */}
      <div className="col-span-2">
        <h2 className="text-xl font-bold mb-4">Productos</h2>

        <div className="grid grid-cols-3 gap-4">
          {products.map((p) => {
            const isOut = p.stock === 0;
            const isLow = p.stock > 0 && p.stock <= p.min_stock;

            return (
              <button
                key={p.product_id}
                onClick={() => addToCart(p)}
                disabled={isOut}
                className={`border rounded p-4 text-left relative ${
                  isOut
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="font-semibold">{p.name}</div>
                <div>${p.price}</div>
                <div className="text-sm text-gray-500">
                  Stock: {p.stock}
                </div>

                {isLow && (
                  <span className="absolute top-2 right-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                    Stock bajo
                  </span>
                )}

                {isOut && (
                  <span className="absolute top-2 right-2 text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">
                    Sin stock
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ticket */}
      <div>
        <h2 className="text-xl font-bold mb-4">Ticket</h2>

        {cart.length === 0 && (
          <div className="text-sm text-gray-500 mb-2">
            Agrega productos para comenzar
          </div>
        )}

        {cart.map((item) => (
          <div
            key={item.product_id}
            className="flex justify-between mb-2"
          >
            <span>
              {item.name} x{item.quantity}
              {item.hasSpecialPrice && (
                <span className="ml-1 text-xs text-blue-600">
                  (horario)
                </span>
              )}
            </span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}

        <div className="mt-4 font-bold">
          Total: ${total.toFixed(2)}
        </div>

        {totalUsd !== null && (
          <div className="text-sm text-gray-500">
            ≈ USD ${totalUsd.toFixed(2)}
          </div>
        )}

        <button
          onClick={() => setIsPaymentOpen(true)}
          className="mt-4 w-full bg-black text-white py-2 rounded disabled:opacity-50"
          disabled={cart.length === 0}
        >
          Cobrar
        </button>
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
