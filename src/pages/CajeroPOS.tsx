import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PaymentModal from "@/components/PaymentModal";
import { usePosAuth } from "@/contexts/AuthContext";

type ProductRow = {
  product_id: string;
  stock: number;
  name: string;
  price: number;
  sku: string;
  category: string;
};

type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

type PaymentMethod = "cash" | "card" | "mixed";

type PaymentPayload = {
  payment_method: PaymentMethod;
  payment_cash: number;
  payment_usd: number;
  payment_card: number;
};

type TicketData = {
  sale: any;
  items: CartItem[];
  payment: PaymentPayload;
  exchangeRate: number;
};

export default function CajeroPOS() {
  const { user } = usePosAuth();
  const storeId = user?.store_id;

  const role = (user as any)?.rol ?? "cajero";
  const showStock = role !== "cajero";

  const searchRef = useRef<HTMLInputElement>(null);
  const saleSubmittingRef = useRef(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("TODOS");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [total, setTotal] = useState(0);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const [openingAmount, setOpeningAmount] = useState("");
  const [openingRate, setOpeningRate] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [openingLoading, setOpeningLoading] = useState(false);

  const [ticket, setTicket] = useState<TicketData | null>(null);

  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  useEffect(() => {
    const t = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    setTotal(t);
  }, [cart]);

  useEffect(() => {
    focusSearch();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [search, products, selectedCategory]);

  function filterProducts() {
    let list = [...products];

    if (selectedCategory !== "TODOS") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.sku || "").toLowerCase().includes(term)
      );
    }

    setFilteredProducts(list);
  }

  useEffect(() => {
    if (storeId) checkOpenSession();
  }, [storeId]);

  useEffect(() => {
    if (storeId && sessionId) loadProducts();
  }, [storeId, sessionId]);

  async function checkOpenSession() {
    setCheckingSession(true);

    const { data } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "open")
      .maybeSingle();

    if (data) {
      setSessionId(data.id);
      setExchangeRate(Number(data.exchange_rate));
    }

    setCheckingSession(false);
  }

  async function handleOpenSession() {
    if (!storeId || !user?.id) return;

    if (!openingAmount || !openingRate) {
      alert("Debe ingresar monto inicial y tipo de cambio.");
      return;
    }

    setOpeningLoading(true);

    const { data } = await supabase
      .from("cash_sessions")
      .insert({
        store_id: storeId,
        opening_amount: Number(openingAmount),
        exchange_rate: Number(openingRate),
        status: "open",
        opened_at: new Date(),
        opened_by: user.id,
      })
      .select()
      .single();

    setOpeningLoading(false);

    if (!data) {
      alert("Error al abrir turno");
      return;
    }

    setSessionId(data.id);
    setExchangeRate(Number(openingRate));
    focusSearch();
  }

  async function loadProducts() {
    const { data: inv } = await supabase
      .from("inventory")
      .select("product_id, stock")
      .eq("store_id", storeId);

    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price, sku, category");

    if (!inv || !prods) return;

    const merged: ProductRow[] = inv.map((i) => {
      const p = prods.find((x) => x.id === i.product_id);

      return {
        product_id: i.product_id,
        stock: Number(i.stock || 0),
        name: p?.name || "Sin nombre",
        price: Number(p?.price || 0),
        sku: String(p?.sku || ""),
        category: String(p?.category || "OTROS"),
      };
    });

    setProducts(merged);
    setFilteredProducts(merged);
  }

  function addProductToCart(product: ProductRow) {
    if (product.stock <= 0) {
      alert("Producto sin stock");
      return;
    }

    setCart((prev) => {
      const exist = prev.find((x) => x.product_id === product.product_id);

      if (exist) {
        return prev.map((x) =>
          x.product_id === product.product_id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [
        ...prev,
        {
          product_id: product.product_id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });

    focusSearch();
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
  }

  function handleScannerEnter() {
    const term = search.trim().toLowerCase();
    if (!term) return;

    const product =
      products.find((p) => (p.sku || "").toLowerCase() === term) ||
      products.find((p) => p.name.toLowerCase() === term);

    if (product) {
      addProductToCart(product);
      setSearch("");
    }

    focusSearch();
  }

  function normalizePayment(
    payment: PaymentPayload,
    totalAmount: number,
    rate: number
  ) {
    const method = payment.payment_method;

    const enteredCash = Number(payment.payment_cash || 0);
    const enteredCard = Number(payment.payment_card || 0);
    const enteredUsd = Number(payment.payment_usd || 0);

    let remaining = Number(totalAmount.toFixed(4));

    let appliedCash = 0;
    let appliedCard = 0;
    let appliedUsd = 0;

    if (method === "card") {
      appliedCard = Number(totalAmount.toFixed(2));
    }

    if (method === "cash") {
      const usdAppliedMxn = Math.min(enteredUsd * rate, remaining);
      appliedUsd = Number((usdAppliedMxn / rate).toFixed(4));
      remaining = Number((remaining - usdAppliedMxn).toFixed(4));

      const cashApplied = Math.min(enteredCash, remaining);
      appliedCash = Number(cashApplied.toFixed(2));
      remaining = Number((remaining - cashApplied).toFixed(4));
    }

    if (method === "mixed") {
      const cardApplied = Math.min(enteredCard, remaining);
      appliedCard = Number(cardApplied.toFixed(2));
      remaining = Number((remaining - cardApplied).toFixed(4));

      const usdAppliedMxn = Math.min(enteredUsd * rate, remaining);
      appliedUsd = Number((usdAppliedMxn / rate).toFixed(4));
      remaining = Number((remaining - usdAppliedMxn).toFixed(4));

      const cashApplied = Math.min(enteredCash, remaining);
      appliedCash = Number(cashApplied.toFixed(2));
      remaining = Number((remaining - cashApplied).toFixed(4));
    }

    return {
      payment_method: method,
      payment_cash: Number(appliedCash.toFixed(2)),
      payment_card: Number(appliedCard.toFixed(2)),
      payment_usd: Number(appliedUsd.toFixed(4)),
    };
  }

  async function handleConfirmSale(payment: PaymentPayload) {
    if (!storeId || !sessionId) return;

    if (saleSubmittingRef.current) {
      return;
    }

    saleSubmittingRef.current = true;

    try {
      const rate = exchangeRate || 1;
      const normalizedPayment = normalizePayment(payment, total, rate);

      const { data: sale } = await supabase
        .from("sales")
        .insert({
          store_id: storeId,
          cash_session_id: sessionId,
          total: total,
          payment_method: normalizedPayment.payment_method,
          payment_cash: normalizedPayment.payment_cash,
          payment_usd: normalizedPayment.payment_usd,
          payment_card: normalizedPayment.payment_card,
          user_name: user?.nombre || "Cajero",
          created_at: new Date(),
        })
        .select()
        .single();

      if (!sale) {
        alert("Error al registrar venta");
        return;
      }

      const items = cart.map((c) => ({
        sale_id: sale.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_price: c.price,
        subtotal: c.price * c.quantity,
      }));

      const { error: salesItemsError } = await supabase
        .from("sales_items")
        .insert(items);

      if (salesItemsError) {
        throw salesItemsError;
      }

      for (const c of cart) {
        const { data: invRow } = await supabase
          .from("inventory")
          .select("id")
          .eq("product_id", c.product_id)
          .eq("store_id", storeId)
          .single();

        if (!invRow) continue;

        const { error: movementError } = await supabase
          .from("inventory_movements")
          .insert({
            inventory_id: invRow.id,
            product_id: c.product_id,
            store_id: storeId,
            type: "sale",
            quantity: -c.quantity,
            reason: "POS sale",
            user_id: user?.id,
            created_at: new Date(),
          });

        if (movementError) {
          throw movementError;
        }
      }

      setTicket({
        sale,
        items: cart,
        payment,
        exchangeRate: rate,
      });

      await loadProducts();

      setCart([]);
      setIsPaymentOpen(false);
      setSearch("");
      focusSearch();
    } catch (err: any) {
      alert("Error inesperado: " + err.message);
    } finally {
      saleSubmittingRef.current = false;
    }
  }

  const categories = [
    "TODOS",
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

  if (checkingSession) {
    return <div className="p-6 text-xl">Verificando sesión...</div>;
  }

  if (!sessionId) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-3xl font-bold mb-4">Abrir Turno</h2>

        <input
          type="number"
          placeholder="Monto inicial"
          className="border w-full p-4 mb-4 text-lg"
          value={openingAmount}
          onChange={(e) => setOpeningAmount(e.target.value)}
        />

        <input
          type="number"
          placeholder="Tipo de cambio"
          className="border w-full p-4 mb-4 text-lg"
          value={openingRate}
          onChange={(e) => setOpeningRate(e.target.value)}
        />

        <button
          className="bg-green-600 text-white px-4 py-4 w-full text-lg"
          onClick={handleOpenSession}
          disabled={openingLoading}
        >
          Abrir Turno
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">
        Punto de Venta – {user?.nombre}
      </h1>

      <input
        ref={searchRef}
        type="text"
        placeholder="Escanear o buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleScannerEnter();
        }}
        className="border w-full p-4 mb-4 text-lg"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`px-3 py-2 border ${
              selectedCategory === cat ? "bg-blue-600 text-white" : ""
            }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {filteredProducts.map((p) => (
            <button
              key={p.product_id}
              className="border p-5 text-left text-lg"
              onClick={() => addProductToCart(p)}
            >
              <div className="font-bold text-xl">{p.name}</div>
              <div className="text-lg">${p.price}</div>

              {showStock && (
                <div className="text-sm text-gray-500">Stock: {p.stock}</div>
              )}
            </button>
          ))}
        </div>

        <div className="border p-4">
          <h2 className="text-2xl font-bold mb-3">Carrito</h2>

          {cart.map((c) => (
            <div
              key={c.product_id}
              className="flex items-center justify-between mb-2"
            >
              <span>{c.name}</span>

              <div className="flex items-center gap-2">
                <button
                  className="bg-gray-300 px-2 py-1"
                  onClick={() => changeQuantity(c.product_id, -1)}
                >
                  -
                </button>

                <span className="font-bold">{c.quantity}</span>

                <button
                  className="bg-gray-300 px-2 py-1"
                  onClick={() => changeQuantity(c.product_id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="mt-4 text-3xl font-bold">
            Total: ${total.toFixed(2)}
          </div>

          <button
            className="bg-blue-600 text-white px-4 py-4 mt-4 w-full text-xl"
            onClick={() => setIsPaymentOpen(true)}
            disabled={cart.length === 0}
          >
            Cobrar
          </button>

          <button
            className="bg-red-600 text-white px-4 py-3 mt-3 w-full"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            Vaciar carrito
          </button>
        </div>
      </div>

      <PaymentModal
        open={isPaymentOpen}
        total={total}
        exchangeRate={exchangeRate || 1}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={handleConfirmSale}
      />

      {ticket && (
        <TicketModal
          ticket={ticket}
          onClose={() => {
            setTicket(null);
            focusSearch();
          }}
        />
      )}
    </div>
  );
}

function TicketModal({
  ticket,
  onClose,
}: {
  ticket: TicketData;
  onClose: () => void;
}) {
  const subtotalItems = ticket.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const totalPagado =
    Number(ticket.payment.payment_cash || 0) +
    Number(ticket.payment.payment_card || 0) +
    Number(ticket.payment.payment_usd || 0) * Number(ticket.exchangeRate || 1);

  const cambio = totalPagado - subtotalItems;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">BEER ZONE</h2>
          <p className="text-sm">ALGO MAS</p>
        </div>

        <div className="mb-4 text-sm space-y-1">
          <div>
            <span className="font-semibold">Folio:</span>{" "}
            {ticket.sale?.id || "N/A"}
          </div>
          <div>
            <span className="font-semibold">Fecha:</span>{" "}
            {ticket.sale?.created_at
              ? new Date(ticket.sale.created_at).toLocaleString()
              : new Date().toLocaleString()}
          </div>
          <div>
            <span className="font-semibold">Cajero:</span>{" "}
            {ticket.sale?.user_name || "Cajero"}
          </div>
        </div>

        <div className="border-t border-b py-3 mb-4">
          {ticket.items.map((item) => (
            <div
              key={item.product_id}
              className="flex justify-between items-center mb-2 text-sm"
            >
              <div>
                {item.name} x{item.quantity}
              </div>
              <div>${(item.price * item.quantity).toFixed(2)}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm mb-4">
          <div className="flex justify-between">
            <span>Efectivo</span>
            <span>${Number(ticket.payment.payment_cash || 0).toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>Tarjeta</span>
            <span>${Number(ticket.payment.payment_card || 0).toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>USD</span>
            <span>${Number(ticket.payment.payment_usd || 0).toFixed(4)}</span>
          </div>

          <div className="flex justify-between">
            <span>Tipo de cambio</span>
            <span>{Number(ticket.exchangeRate || 1).toFixed(4)}</span>
          </div>

          <div className="flex justify-between font-bold text-base pt-2">
            <span>Total</span>
            <span>${subtotalItems.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>Cambio</span>
            <span>${(cambio > 0 ? cambio : 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center text-xs mb-4">OPTICODE LABS</div>

        <div className="flex gap-2">
          <button
            className="bg-black text-white px-4 py-2 rounded w-full"
            onClick={() => window.print()}
          >
            Imprimir
          </button>

          <button
            className="border px-4 py-2 rounded w-full"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}