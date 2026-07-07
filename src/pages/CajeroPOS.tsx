import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PaymentModal from "@/components/PaymentModal";
import { usePosAuth } from "@/contexts/AuthContext";
import beerZoneLogo from "@/assets/beer-zone-logo.png";

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

type PromotionRow = {
  id: string;
  name: string;
  promo_type: "simple" | "combo" | "six";
  required_quantity: number;
  promo_price: number;
  active: boolean;
};

type PromotionProductRow = {
  promotion_id: string;
  product_id: string;
  required_units: number;
};

type Promotion = {
  id: string;
  name: string;
  promo_type: "simple" | "combo" | "six";
  required_quantity: number;
  promo_price: number;
  active: boolean;
  products: {
    product_id: string;
    required_units: number;
  }[];
};

type TicketLineItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  pricing_type: "regular" | "promo" | "night";
  promo_name?: string | null;
};

type TicketData = {
  sale: any;
  items: TicketLineItem[];
  payment: PaymentPayload;
  exchangeRate: number;
};

type CashBreakdownItem = {
  label: string;
  denomination: number;
  quantity: number;
  subtotal: number;
};

type WithdrawalTicketData = {
  id: string;
  sessionId: string;
  storeName: string;
  amount: number;
  reason: string;
  createdAt: string;
  cashierName: string;
  availableAfterWithdrawal: number;
  cashBreakdown: CashBreakdownItem[];
  breakdownTotal: number;
};

type PricedCartSummary = {
  items: TicketLineItem[];
  total: number;
  nightPricingActive: boolean;
};

type CashSessionRow = {
  id: string;
  exchange_rate: number | null;
  opening_amount: number | null;
  opened_by?: string | null;
};

type OtherOpenSessionRow = {
  id: string;
  opened_by: string | null;
  openedByName: string;
};

type StoreOption = {
  id: string;
  name: string;
};

const WITHDRAWAL_THRESHOLD_MXN = 2000;

function round2(value: number) {
  return Number(value.toFixed(2));
}

function round4(value: number) {
  return Number(value.toFixed(4));
}

function formatCashBreakdownForReason(items: CashBreakdownItem[]) {
  if (items.length === 0) return "Sin desglose";

  return items
    .map((item) => {
      if (item.quantity === 1 && item.label === "Monedas / otros") {
        return `${item.label}: $${item.subtotal.toFixed(2)}`;
      }

      return `${item.label} x ${item.quantity} = $${item.subtotal.toFixed(2)}`;
    })
    .join("; ");
}

function isNightPricingActive(date = new Date()) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const start = 23 * 60;
  const end = 1 * 60;

  return totalMinutes >= start || totalMinutes < end;
}

function distributeCentsByWeight(
  entries: { key: string; weight: number }[],
  totalCents: number
) {
  const result = new Map<string, number>();

  if (entries.length === 0) return result;

  const totalWeight = entries.reduce((acc, entry) => acc + entry.weight, 0);

  if (totalWeight <= 0) {
    const base = Math.floor(totalCents / entries.length);
    let remainder = totalCents - base * entries.length;

    entries.forEach((entry) => {
      const extra = remainder > 0 ? 1 : 0;
      result.set(entry.key, base + extra);
      if (remainder > 0) remainder -= 1;
    });

    return result;
  }

  const provisional = entries.map((entry) => {
    const exact = (entry.weight / totalWeight) * totalCents;
    const floorValue = Math.floor(exact);

    return {
      key: entry.key,
      floorValue,
      fraction: exact - floorValue,
    };
  });

  let assigned = provisional.reduce((acc, entry) => acc + entry.floorValue, 0);
  let remainder = totalCents - assigned;

  provisional
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((entry) => {
      const extra = remainder > 0 ? 1 : 0;
      result.set(entry.key, entry.floorValue + extra);
      if (remainder > 0) remainder -= 1;
    });

  return result;
}

function buildPromotions(
  promotionsRows: PromotionRow[],
  promotionProductsRows: PromotionProductRow[]
): Promotion[] {
  const grouped = new Map<string, Promotion>();

  for (const row of promotionsRows) {
    grouped.set(row.id, {
      id: row.id,
      name: row.name,
      promo_type: row.promo_type,
      required_quantity: Number(row.required_quantity || 0),
      promo_price: Number(row.promo_price || 0),
      active: Boolean(row.active),
      products: [],
    });
  }

  for (const row of promotionProductsRows) {
    const promo = grouped.get(row.promotion_id);
    if (!promo) continue;

    promo.products.push({
      product_id: row.product_id,
      required_units: Number(row.required_units || 1),
    });
  }

  return Array.from(grouped.values()).filter(
    (promo) => promo.active && promo.products.length > 0
  );
}

function calculatePromotionSavings(
  promo: Promotion,
  productMap: Map<string, ProductRow>
) {
  const baseTotal = promo.products.reduce((acc, promoProduct) => {
    const product = productMap.get(promoProduct.product_id);
    if (!product) return acc;

    return acc + Number(product.price || 0) * promoProduct.required_units;
  }, 0);

  return round2(baseTotal - promo.promo_price);
}

function buildPricedCartSummary(
  cart: CartItem[],
  products: ProductRow[],
  promotions: Promotion[],
  forceNightPricing = false
): PricedCartSummary {
  const productMap = new Map(
    products.map((product) => [product.product_id, product])
  );
  const cartOrderMap = new Map(
    cart.map((item, index) => [item.product_id, index])
  );
  const nightPricingActive = forceNightPricing || isNightPricingActive();

  const remainingQty = new Map<string, number>();
  for (const item of cart) {
    remainingQty.set(item.product_id, item.quantity);
  }

  const promoApplications: {
    promotion: Promotion;
    times: number;
  }[] = [];

  const sortedPromotions = [...promotions].sort((a, b) => {
    const savingsDiff =
      calculatePromotionSavings(b, productMap) -
      calculatePromotionSavings(a, productMap);

    if (savingsDiff !== 0) return savingsDiff;

    return b.required_quantity - a.required_quantity;
  });

  for (const promo of sortedPromotions) {
    const hasNightBeerProduct =
      nightPricingActive &&
      promo.products.some((promoProduct) => {
        const product = productMap.get(promoProduct.product_id);
        return product?.category === "CERVEZA";
      });

    if (hasNightBeerProduct) {
      continue;
    }

    let times = Number.POSITIVE_INFINITY;

    for (const promoProduct of promo.products) {
      const available = Number(remainingQty.get(promoProduct.product_id) || 0);
      const possibleTimes = Math.floor(
        available / promoProduct.required_units
      );
      times = Math.min(times, possibleTimes);
    }

    if (!Number.isFinite(times) || times <= 0) continue;

    promoApplications.push({
      promotion: promo,
      times,
    });

    for (const promoProduct of promo.products) {
      const current = Number(remainingQty.get(promoProduct.product_id) || 0);
      remainingQty.set(
        promoProduct.product_id,
        current - promoProduct.required_units * times
      );
    }
  }

  const pricedItems: TicketLineItem[] = [];

  for (const application of promoApplications) {
    const promo = application.promotion;
    const times = application.times;

    const expandedProducts = promo.products.map((promoProduct) => {
      const product = productMap.get(promoProduct.product_id);

      return {
        product_id: promoProduct.product_id,
        required_units: promoProduct.required_units * times,
        product,
      };
    });

    const validExpandedProducts = expandedProducts.filter(
      (entry) => entry.product
    ) as {
      product_id: string;
      required_units: number;
      product: ProductRow;
    }[];

    const totalPromoCents = Math.round(promo.promo_price * times * 100);

    const centsMap = distributeCentsByWeight(
      validExpandedProducts.map((entry) => ({
        key: entry.product_id,
        weight: entry.product.price * entry.required_units,
      })),
      totalPromoCents
    );

    for (const entry of validExpandedProducts) {
      const subtotalCents = Number(centsMap.get(entry.product_id) || 0);
      const subtotal = round2(subtotalCents / 100);
      const unitPrice = round4(subtotal / entry.required_units);

      pricedItems.push({
        product_id: entry.product_id,
        name: entry.product.name,
        quantity: entry.required_units,
        unit_price: unitPrice,
        subtotal,
        pricing_type: "promo",
        promo_name: promo.name,
      });
    }
  }

  for (const item of cart) {
    const remaining = Number(remainingQty.get(item.product_id) || 0);
    if (remaining <= 0) continue;

    const product = productMap.get(item.product_id);
    const basePrice = Number(product?.price || item.price || 0);
    const isBeer = product?.category === "CERVEZA";
    const appliesNightPrice = nightPricingActive && isBeer;

    const unitPrice = appliesNightPrice
      ? round4(basePrice * 1.35)
      : round4(basePrice);

    const subtotal = round2(unitPrice * remaining);

    pricedItems.push({
      product_id: item.product_id,
      name: item.name,
      quantity: remaining,
      unit_price: unitPrice,
      subtotal,
      pricing_type: appliesNightPrice ? "night" : "regular",
      promo_name: appliesNightPrice ? "Precio nocturno" : null,
    });
  }

  const orderedItems = pricedItems.sort((a, b) => {
    const aIndex = cartOrderMap.get(a.product_id) ?? 9999;
    const bIndex = cartOrderMap.get(b.product_id) ?? 9999;

    if (aIndex !== bIndex) return aIndex - bIndex;

    const priority = {
      promo: 0,
      night: 1,
      regular: 2,
    };

    return priority[a.pricing_type] - priority[b.pricing_type];
  });

  const total = round2(
    orderedItems.reduce((acc, item) => acc + Number(item.subtotal || 0), 0)
  );

  return {
    items: orderedItems,
    total,
    nightPricingActive,
  };
}

export default function CajeroPOS() {
  const { user } = usePosAuth();

  const role = (user as any)?.rol ?? "cajero";
  const isAdmin = role === "admin";
  const showStock = role !== "cajero";

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const assignedStoreId = user?.store_id || "";
  const activeStoreId = isAdmin ? selectedStoreId : assignedStoreId;
  const activeStoreName =
    stores.find((store) => store.id === activeStoreId)?.name ||
    "Sucursal no identificada";

  const searchRef = useRef<HTMLInputElement>(null);
  const saleSubmittingRef = useRef(false);
  const withdrawalSubmittingRef = useRef(false);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductRow[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("TODOS");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [sessionOpeningAmount, setSessionOpeningAmount] = useState<number>(0);
  const [cashAvailableForWithdrawal, setCashAvailableForWithdrawal] =
    useState<number>(0);
  const [cashWithdrawalBlocked, setCashWithdrawalBlocked] = useState(false);
  const [cashStatusLoading, setCashStatusLoading] = useState(false);
  const [sessionConflictMessage, setSessionConflictMessage] = useState("");
  const [adminNoticeMessage, setAdminNoticeMessage] = useState("");
  const [adminNightTestMode, setAdminNightTestMode] = useState(false);

  const [openingAmount, setOpeningAmount] = useState("");
  const [openingRate, setOpeningRate] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [openingLoading, setOpeningLoading] = useState(false);

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [withdrawalTicket, setWithdrawalTicket] =
    useState<WithdrawalTicketData | null>(null);

  const adminReadOnlyMode = isAdmin;
  const adminNightPricingTestActive = isAdmin && adminNightTestMode;
  const canOperateSales = !adminReadOnlyMode && !!sessionId;

  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function getProductFromState(productId: string) {
    return products.find((product) => product.product_id === productId);
  }

  function getCartQuantity(productId: string) {
    const item = cart.find((cartItem) => cartItem.product_id === productId);
    return Number(item?.quantity || 0);
  }

  function getProductStock(productId: string) {
    const product = getProductFromState(productId);
    return Number(product?.stock || 0);
  }

  async function validateCartAgainstLatestStock() {
    if (!activeStoreId) {
      return {
        ok: false,
        message: "No hay sucursal activa para validar inventario.",
      };
    }

    if (cart.length === 0) {
      return {
        ok: false,
        message: "El carrito estÃ¡ vacÃ­o.",
      };
    }

    const productIds = cart.map((item) => item.product_id);

    const { data, error } = await supabase
      .from("inventory")
      .select("product_id, stock")
      .eq("store_id", activeStoreId)
      .in("product_id", productIds);

    if (error || !data) {
      return {
        ok: false,
        message:
          "No se pudo validar el inventario actualizado. Intenta nuevamente.",
      };
    }

    const latestStockMap = new Map<string, number>();

    for (const row of data as { product_id: string; stock: number }[]) {
      latestStockMap.set(row.product_id, Number(row.stock || 0));
    }

    for (const item of cart) {
      const latestStock = Number(latestStockMap.get(item.product_id) || 0);

      if (item.quantity > latestStock) {
        return {
          ok: false,
          message: `No hay suficiente stock disponible para ${item.name}. Stock actual: ${latestStock}. Cantidad en carrito: ${item.quantity}.`,
        };
      }
    }

    return {
      ok: true,
      message: "",
    };
  }

  useEffect(() => {
    focusSearch();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [search, products, selectedCategory]);

  useEffect(() => {
    if (!user) return;
    loadStores();
  }, [user?.id, role]);

  useEffect(() => {
    if (!activeStoreId) {
      setCheckingSession(false);
      return;
    }

    checkOpenSession();
    loadProducts();
    loadPromotions();
  }, [activeStoreId, role, user?.id]);

  useEffect(() => {
    if (activeStoreId && sessionId && !adminReadOnlyMode) {
      loadCashWithdrawalStatus(sessionId);
    }
  }, [activeStoreId, sessionId, sessionOpeningAmount, adminReadOnlyMode]);

  const pricedCartSummary = useMemo(() => {
    return buildPricedCartSummary(
      cart,
      products,
      promotions,
      adminNightPricingTestActive
    );
  }, [cart, products, promotions, adminNightPricingTestActive]);

  const total = useMemo(() => {
    return round2(
      pricedCartSummary.items.reduce(
        (acc, item) => acc + Number(item.subtotal || 0),
        0
      )
    );
  }, [pricedCartSummary.items]);

  async function loadStores() {
    if (!user) {
      setStores([]);
      setSelectedStoreId("");
      return;
    }

    if (!isAdmin) {
      if (assignedStoreId) {
        const { data } = await supabase
          .from("pos_stores")
          .select("id, name")
          .eq("id", assignedStoreId)
          .maybeSingle();

        if (data) {
          setStores([data]);
          setSelectedStoreId(data.id);
        } else {
          setStores([]);
          setSelectedStoreId("");
        }
      }

      return;
    }

    const { data, error } = await supabase
      .from("pos_stores")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error cargando sucursales:", error);
      setStores([]);
      setSelectedStoreId("");
      return;
    }

    const activeStores = (data ?? []) as StoreOption[];
    setStores(activeStores);

    if (!selectedStoreId && activeStores.length > 0) {
      setSelectedStoreId(activeStores[0].id);
    }
  }

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

  async function fetchCurrentOpenSession(): Promise<CashSessionRow | null> {
    if (!activeStoreId || !user?.id) return null;

    const { data, error } = await supabase
      .from("cash_sessions")
      .select("id, exchange_rate, opening_amount, opened_by")
      .eq("store_id", activeStoreId)
      .eq("opened_by", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as CashSessionRow;
  }

  async function fetchOtherOpenSessionInStore(): Promise<OtherOpenSessionRow | null> {
    if (!activeStoreId || !user?.id) return null;

    const { data, error } = await supabase
      .from("cash_sessions")
      .select("id, opened_by")
      .eq("store_id", activeStoreId)
      .eq("status", "open")
      .neq("opened_by", user.id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    let openedByName = "otro usuario";

    if (data.opened_by) {
      const { data: userRow } = await supabase
        .from("pos_users")
        .select("nombre")
        .eq("id", data.opened_by)
        .maybeSingle();

      if (userRow?.nombre) {
        openedByName = userRow.nombre;
      }
    }

    return {
      id: data.id,
      opened_by: data.opened_by,
      openedByName,
    };
  }

  async function fetchAnyOpenSessionInStore(): Promise<OtherOpenSessionRow | null> {
    if (!activeStoreId) return null;

    const { data, error } = await supabase
      .from("cash_sessions")
      .select("id, opened_by")
      .eq("store_id", activeStoreId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    let openedByName = "otro usuario";

    if (data.opened_by) {
      const { data: userRow } = await supabase
        .from("pos_users")
        .select("nombre")
        .eq("id", data.opened_by)
        .maybeSingle();

      if (userRow?.nombre) {
        openedByName = userRow.nombre;
      }
    }

    return {
      id: data.id,
      opened_by: data.opened_by,
      openedByName,
    };
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isOpenPaymentShortcut =
        event.key === "F12" ||
        (event.ctrlKey &&
          event.altKey &&
          event.key.toLowerCase() === "c");

      if (isOpenPaymentShortcut) {
        event.preventDefault();

        if (adminReadOnlyMode) {
          alert(
            "El usuario administrador estÃ¡ en modo consulta. Para vender, debe operar un cajero con turno abierto."
          );
          return;
        }

        if (sessionConflictMessage) {
          alert(sessionConflictMessage);
          return;
        }

        if (cashStatusLoading) {
          alert("Verificando estatus de caja. Intenta nuevamente en un momento.");
          return;
        }

        if (cashWithdrawalBlocked) {
          alert(
            "Ventas bloqueadas: hay $2,000 MXN o mÃ¡s generados por dinero fÃ­sico en caja disponible para retiro. Debe realizarse el retiro antes de continuar."
          );
          return;
        }

        if (cart.length > 0 && !isPaymentOpen && !ticket && !withdrawalTicket) {
          setIsPaymentOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cart.length,
    isPaymentOpen,
    ticket,
    withdrawalTicket,
    cashWithdrawalBlocked,
    cashStatusLoading,
    sessionConflictMessage,
    adminReadOnlyMode,
  ]);

  async function loadCashWithdrawalStatus(currentSessionId: string) {
    setCashStatusLoading(true);

    try {
      const { data: sessionRow, error: sessionError } = await supabase
        .from("cash_sessions")
        .select("exchange_rate")
        .eq("id", currentSessionId)
        .maybeSingle();

      const { data: cashSalesRows, error: cashSalesError } = await supabase
        .from("sales")
        .select("payment_cash, payment_usd")
        .eq("cash_session_id", currentSessionId);

      const { data: withdrawalRows, error: withdrawalError } = await supabase
        .from("cash_withdrawals")
        .select("amount")
        .eq("cash_session_id", currentSessionId);

      if (sessionError || cashSalesError || withdrawalError) {
        console.error(
          "Error calculando disponible para retiro:",
          sessionError || cashSalesError || withdrawalError
        );

        setCashAvailableForWithdrawal(0);
        setCashWithdrawalBlocked(false);

        return {
          availableForWithdrawal: 0,
          blocked: false,
          error: true,
        };
      }

      const sessionRate = Number(
        sessionRow?.exchange_rate || exchangeRate || 1
      );

      const totalPhysicalCashMxn = round2(
        (cashSalesRows ?? []).reduce((acc, row: any) => {
          const cashMxn = Number(row.payment_cash || 0);
          const usdAsMxn = Number(row.payment_usd || 0) * sessionRate;

          return acc + cashMxn + usdAsMxn;
        }, 0)
      );

      const totalWithdrawnMxn = round2(
        (withdrawalRows ?? []).reduce((acc, row: any) => {
          return acc + Number(row.amount || 0);
        }, 0)
      );

      const availableForWithdrawal = Math.max(
        0,
        round2(totalPhysicalCashMxn - totalWithdrawnMxn)
      );

      const blocked = availableForWithdrawal >= WITHDRAWAL_THRESHOLD_MXN;

      setCashAvailableForWithdrawal(availableForWithdrawal);
      setCashWithdrawalBlocked(blocked);

      return {
        availableForWithdrawal,
        blocked,
        error: false,
      };
    } catch (err) {
      console.error("Error inesperado calculando retiro:", err);

      setCashAvailableForWithdrawal(0);
      setCashWithdrawalBlocked(false);

      return {
        availableForWithdrawal: 0,
        blocked: false,
        error: true,
      };
    } finally {
      setCashStatusLoading(false);
    }
  }

  async function checkOpenSession() {
    setCheckingSession(true);
    setSessionConflictMessage("");
    setAdminNoticeMessage("");

    if (!activeStoreId) {
      setSessionId(null);
      setExchangeRate(null);
      setSessionOpeningAmount(0);
      setCashAvailableForWithdrawal(0);
      setCashWithdrawalBlocked(false);
      setCheckingSession(false);
      return;
    }

    if (adminReadOnlyMode) {
      const openSession = await fetchAnyOpenSessionInStore();

      setSessionId(null);
      setExchangeRate(null);
      setSessionOpeningAmount(0);
      setCashAvailableForWithdrawal(0);
      setCashWithdrawalBlocked(false);
      setSessionConflictMessage("");

      if (openSession) {
        setAdminNoticeMessage(
          `Modo administrador: puedes consultar esta sucursal. Hay un turno abierto por ${openSession.openedByName}; las ventas permanecen protegidas para no afectar la caja del cajero.`
        );
      } else {
        setAdminNoticeMessage(
          "Modo administrador: puedes consultar productos y stock de esta sucursal. Las ventas estÃ¡n deshabilitadas para este acceso."
        );
      }

      setCheckingSession(false);
      return;
    }

    const currentSession = await fetchCurrentOpenSession();

    if (currentSession) {
      setSessionId(currentSession.id);
      setExchangeRate(Number(currentSession.exchange_rate || 0));
      setSessionOpeningAmount(Number(currentSession.opening_amount || 0));
      setSessionConflictMessage("");
      await loadCashWithdrawalStatus(currentSession.id);
      setCheckingSession(false);
      return;
    }

    const otherSession = await fetchOtherOpenSessionInStore();

    if (otherSession) {
      setSessionId(null);
      setExchangeRate(null);
      setSessionOpeningAmount(0);
      setCashAvailableForWithdrawal(0);
      setCashWithdrawalBlocked(false);
      setSessionConflictMessage(
        `Esta sucursal ya tiene un turno abierto por ${otherSession.openedByName}. Para operar aquÃ­, primero debe cerrarse ese turno o ingresar con el usuario correspondiente.`
      );
      setCheckingSession(false);
      return;
    }

    setSessionId(null);
    setExchangeRate(null);
    setSessionOpeningAmount(0);
    setCashAvailableForWithdrawal(0);
    setCashWithdrawalBlocked(false);
    setSessionConflictMessage("");
    setCheckingSession(false);
  }

  async function handleOpenSession() {
    if (!activeStoreId || !user?.id) return;

    if (adminReadOnlyMode) {
      alert(
        "El usuario administrador estÃ¡ en modo consulta. Para vender, debe operar un cajero con turno abierto."
      );
      return;
    }

    if (!openingAmount || !openingRate) {
      alert("Debe ingresar monto inicial y tipo de cambio.");
      return;
    }

    setOpeningLoading(true);

    const existingUserSession = await fetchCurrentOpenSession();

    if (existingUserSession) {
      setSessionId(existingUserSession.id);
      setExchangeRate(Number(existingUserSession.exchange_rate || openingRate));
      setSessionOpeningAmount(
        Number(existingUserSession.opening_amount || openingAmount)
      );
      await loadCashWithdrawalStatus(existingUserSession.id);
      setOpeningLoading(false);
      focusSearch();
      return;
    }

    const otherSession = await fetchOtherOpenSessionInStore();

    if (otherSession) {
      const message = `Esta sucursal ya tiene un turno abierto por ${otherSession.openedByName}. Para operar aquÃ­, primero debe cerrarse ese turno o ingresar con el usuario correspondiente.`;

      setSessionConflictMessage(message);
      setOpeningLoading(false);
      alert(message);
      return;
    }

    const { data, error } = await supabase
      .from("cash_sessions")
      .insert({
        store_id: activeStoreId,
        opening_amount: Number(openingAmount),
        exchange_rate: Number(openingRate),
        status: "open",
        opened_at: new Date(),
        opened_by: user.id,
      })
      .select("id, exchange_rate, opening_amount")
      .single();

    setOpeningLoading(false);

    if (error || !data) {
      if ((error as any)?.code === "23505") {
        alert(
          "Este usuario ya tiene un turno abierto en otra sucursal. Debe cerrar ese turno antes de abrir uno nuevo."
        );
        return;
      }

      alert("Error al abrir turno");
      return;
    }

    setSessionId(data.id);
    setExchangeRate(Number(data.exchange_rate || openingRate));
    setSessionOpeningAmount(Number(data.opening_amount || openingAmount));
    setCashAvailableForWithdrawal(0);
    setCashWithdrawalBlocked(false);
    setSessionConflictMessage("");
    focusSearch();
  }

  async function loadProducts() {
    if (!activeStoreId) {
      setProducts([]);
      setFilteredProducts([]);
      return;
    }

    const { data: inv, error: invError } = await supabase
      .from("inventory")
      .select("product_id, stock")
      .eq("store_id", activeStoreId);

    const { data: prods, error: prodsError } = await supabase
      .from("products")
      .select("id, name, price, sku, category, active");

    if (invError || prodsError || !inv || !prods) {
      console.error("Error cargando productos del POS:", invError || prodsError);
      setProducts([]);
      setFilteredProducts([]);
      return;
    }

    const activeProducts = (prods as any[]).filter((product) => product.active);

    const merged: ProductRow[] = inv
      .map((i: any) => {
        const p = activeProducts.find((x) => x.id === i.product_id);

        if (!p) return null;

        return {
          product_id: i.product_id,
          stock: Number(i.stock || 0),
          name: p?.name || "Sin nombre",
          price: Number(p?.price || 0),
          sku: String(p?.sku || ""),
          category: String(p?.category || "OTROS"),
        };
      })
      .filter(Boolean) as ProductRow[];

    merged.sort((a, b) => a.name.localeCompare(b.name));

    setProducts(merged);
    setFilteredProducts(merged);
  }

  async function loadPromotions() {
    const { data: promoRows } = await supabase
      .from("promotions")
      .select("id, name, promo_type, required_quantity, promo_price, active")
      .eq("active", true);

    const { data: promoProductRows } = await supabase
      .from("promotion_products")
      .select("promotion_id, product_id, required_units");

    if (!promoRows || !promoProductRows) {
      setPromotions([]);
      return;
    }

    setPromotions(
      buildPromotions(
        promoRows as PromotionRow[],
        promoProductRows as PromotionProductRow[]
      )
    );
  }

  function addProductToCart(product: ProductRow) {
    if (adminReadOnlyMode) {
      alert(
        "El usuario administrador estÃ¡ en modo consulta. Para vender, debe operar un cajero con turno abierto."
      );
      return;
    }

    if (sessionConflictMessage) {
      alert(sessionConflictMessage);
      return;
    }

    if (cashStatusLoading) {
      alert("Verificando estatus de caja. Intenta nuevamente en un momento.");
      return;
    }

    if (cashWithdrawalBlocked) {
      alert(
        "Ventas bloqueadas: hay $2,000 MXN o mÃ¡s generados por dinero fÃ­sico en caja disponible para retiro. Debe realizarse el retiro antes de continuar."
      );
      return;
    }

    if (product.stock <= 0) {
      alert("Producto sin stock");
      return;
    }

    const currentQuantity = getCartQuantity(product.product_id);
    const nextQuantity = currentQuantity + 1;

    if (nextQuantity > product.stock) {
      alert(
        `No hay suficiente stock disponible. Stock actual: ${product.stock}.`
      );
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
    if (adminReadOnlyMode) return;

    const currentQuantity = getCartQuantity(productId);
    const nextQuantity = currentQuantity + amount;

    if (nextQuantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product_id !== productId));
      return;
    }

    if (amount > 0) {
      const stock = getProductStock(productId);

      if (nextQuantity > stock) {
        alert(`No hay suficiente stock disponible. Stock actual: ${stock}.`);
        return;
      }
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: nextQuantity }
          : item
      )
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
    if (!activeStoreId) return;

    if (adminReadOnlyMode) {
      alert(
        "El usuario administrador estÃ¡ en modo consulta. Para vender, debe operar un cajero con turno abierto."
      );
      setIsPaymentOpen(false);
      return;
    }

    if (sessionConflictMessage) {
      alert(sessionConflictMessage);
      setIsPaymentOpen(false);
      return;
    }

    const stockValidation = await validateCartAgainstLatestStock();

    if (!stockValidation.ok) {
      alert(stockValidation.message);
      await loadProducts();
      setIsPaymentOpen(false);
      return;
    }

    const currentSession = await fetchCurrentOpenSession();

    if (!currentSession) {
      const otherSession = await fetchOtherOpenSessionInStore();

      if (otherSession) {
        alert(
          `Esta sucursal ya tiene un turno abierto por ${otherSession.openedByName}. Para operar aquÃ­, primero debe cerrarse ese turno o ingresar con el usuario correspondiente.`
        );
      } else {
        alert("No hay una sesiÃ³n abierta vÃ¡lida para este usuario en esta sucursal.");
      }

      setIsPaymentOpen(false);
      return;
    }

    const activeSessionId = currentSession.id;
    const activeExchangeRate = Number(
      currentSession.exchange_rate || exchangeRate || 1
    );
    const activeOpeningAmount = Number(currentSession.opening_amount || 0);

    setSessionId(activeSessionId);
    setExchangeRate(activeExchangeRate);
    setSessionOpeningAmount(activeOpeningAmount);

    const normalizedPayment = normalizePayment(
      payment,
      total,
      activeExchangeRate
    );

    const preSaleCashStatus = await loadCashWithdrawalStatus(activeSessionId);

    if (preSaleCashStatus.error) {
      alert(
        "No se pudo verificar el efectivo disponible para retiro. Por seguridad, la venta no se registrÃ³. Intenta nuevamente."
      );
      setIsPaymentOpen(false);
      return;
    }

    if (preSaleCashStatus.blocked) {
      alert(
        "Ventas bloqueadas: hay $2,000 MXN o mÃ¡s generados por dinero fÃ­sico en caja disponible para retiro. Debe realizarse el retiro antes de continuar."
      );
      setIsPaymentOpen(false);
      return;
    }

    const physicalCashFromThisSale = round2(
      Number(normalizedPayment.payment_cash || 0) +
        Number(normalizedPayment.payment_usd || 0) * activeExchangeRate
    );

    const availableAfterThisSale = round2(
      preSaleCashStatus.availableForWithdrawal + physicalCashFromThisSale
    );

    if (availableAfterThisSale >= WITHDRAWAL_THRESHOLD_MXN) {
      alert(
        `Venta bloqueada: esta venta dejarÃ­a $${availableAfterThisSale.toFixed(
          2
        )} MXN disponibles para retiro, llegando o superando el lÃ­mite de $${WITHDRAWAL_THRESHOLD_MXN.toFixed(
          2
        )}. Debe realizarse un retiro antes de continuar.`
      );
      setCashAvailableForWithdrawal(preSaleCashStatus.availableForWithdrawal);
      setCashWithdrawalBlocked(
        preSaleCashStatus.availableForWithdrawal >= WITHDRAWAL_THRESHOLD_MXN
      );
      setIsPaymentOpen(false);
      return;
    }

    if (saleSubmittingRef.current) {
      return;
    }

    saleSubmittingRef.current = true;

    try {
      const { data: sale } = await supabase
        .from("sales")
        .insert({
          store_id: activeStoreId,
          cash_session_id: activeSessionId,
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

      const pricedItems = pricedCartSummary.items;

      const items = pricedItems.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
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
          .eq("store_id", activeStoreId)
          .single();

        if (!invRow) continue;

        const { error: movementError } = await supabase
          .from("inventory_movements")
          .insert({
            inventory_id: invRow.id,
            product_id: c.product_id,
            store_id: activeStoreId,
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
        items: pricedItems,
        payment,
        exchangeRate: activeExchangeRate,
      });

      await loadProducts();
      await loadCashWithdrawalStatus(activeSessionId);

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

  async function handleConfirmWithdrawal(
    amountInput: string,
    reasonInput: string,
    cashBreakdown: CashBreakdownItem[],
    breakdownTotal: number
  ) {
    if (!activeStoreId) return;

    if (adminReadOnlyMode) {
      alert(
        "El usuario administrador estÃ¡ en modo consulta. Para retirar efectivo, debe operar el usuario con turno abierto."
      );
      setIsWithdrawalOpen(false);
      return;
    }

    if (sessionConflictMessage) {
      alert(sessionConflictMessage);
      setIsWithdrawalOpen(false);
      return;
    }

    const currentSession = await fetchCurrentOpenSession();

    if (!currentSession) {
      const otherSession = await fetchOtherOpenSessionInStore();

      if (otherSession) {
        alert(
          `Esta sucursal ya tiene un turno abierto por ${otherSession.openedByName}. Para operar aquÃ­, primero debe cerrarse ese turno o ingresar con el usuario correspondiente.`
        );
      } else {
        alert("No hay una sesiÃ³n abierta vÃ¡lida para este usuario en esta sucursal.");
      }

      setIsWithdrawalOpen(false);
      return;
    }

    const latestStatus = await loadCashWithdrawalStatus(currentSession.id);

    if (latestStatus.error) {
      alert(
        "No se pudo verificar el efectivo disponible para retiro. Intenta nuevamente."
      );
      return;
    }

    const amount = Number(amountInput);
    const reason = reasonInput.trim() || "Retiro de efectivo";
    const roundedBreakdownTotal = round2(breakdownTotal || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Debe ingresar un monto vÃ¡lido para retiro.");
      return;
    }

    if (amount > latestStatus.availableForWithdrawal) {
      alert("El monto a retirar no puede ser mayor al disponible para retiro.");
      return;
    }

    if (cashBreakdown.length === 0 || roundedBreakdownTotal <= 0) {
      alert("Debe capturar el desglose de billetes/monedas del retiro.");
      return;
    }

    if (round2(amount) !== roundedBreakdownTotal) {
      alert(
        "El monto a retirar debe coincidir con el total del desglose de billetes/monedas."
      );
      return;
    }

    const breakdownText = formatCashBreakdownForReason(cashBreakdown);
    const reasonForDatabase = `${reason} | Sucursal: ${activeStoreName} | Desglose: ${breakdownText}`;

    if (withdrawalSubmittingRef.current) {
      return;
    }

    withdrawalSubmittingRef.current = true;

    try {
      const { data, error } = await supabase
        .from("cash_withdrawals")
        .insert({
          cash_session_id: currentSession.id,
          amount: round2(amount),
          reason: reasonForDatabase,
          created_by: user?.id,
          created_at: new Date(),
        })
        .select()
        .single();

      if (error || !data) {
        throw error || new Error("No se pudo registrar el retiro.");
      }

      const refreshResult = await loadCashWithdrawalStatus(currentSession.id);

      setIsWithdrawalOpen(false);

      setWithdrawalTicket({
        id: data.id,
        sessionId: currentSession.id,
        storeName: activeStoreName,
        amount: round2(amount),
        reason,
        createdAt: data.created_at || new Date().toISOString(),
        cashierName: user?.nombre || "Cajero",
        availableAfterWithdrawal: round2(
          refreshResult?.availableForWithdrawal || 0
        ),
        cashBreakdown,
        breakdownTotal: roundedBreakdownTotal,
      });

      focusSearch();
    } catch (err: any) {
      alert("Error al registrar retiro: " + (err.message || "Error desconocido"));
    } finally {
      withdrawalSubmittingRef.current = false;
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
    return <div className="p-6 text-2xl">Verificando sesiÃ³n...</div>;
  }

  if (!activeStoreId) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white rounded shadow">
        <h2 className="text-2xl font-bold mb-3">Punto de Venta</h2>
        <p className="text-gray-600">
          No hay una sucursal activa disponible para este usuario.
        </p>
      </div>
    );
  }

  if (!sessionId && !adminReadOnlyMode) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h2 className="text-4xl font-bold mb-5">Abrir Turno</h2>

        {sessionConflictMessage && (
          <div className="mb-5 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800 font-semibold">
            {sessionConflictMessage}
          </div>
        )}

        <input
          type="number"
          placeholder="Monto inicial"
          className="border w-full p-4 mb-4 text-xl rounded disabled:bg-gray-100"
          value={openingAmount}
          onChange={(e) => setOpeningAmount(e.target.value)}
          disabled={!!sessionConflictMessage}
        />

        <input
          type="number"
          placeholder="Tipo de cambio"
          className="border w-full p-4 mb-4 text-xl rounded disabled:bg-gray-100"
          value={openingRate}
          onChange={(e) => setOpeningRate(e.target.value)}
          disabled={!!sessionConflictMessage}
        />

        <button
          className="bg-green-600 text-white px-4 py-4 w-full text-xl rounded font-semibold disabled:opacity-50"
          onClick={handleOpenSession}
          disabled={openingLoading || !!sessionConflictMessage}
        >
          {openingLoading ? "Abriendo..." : "Abrir Turno"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-5">
        Punto de Venta â€“ {user?.nombre}
      </h1>

      {isAdmin && (
        <div className="mb-4 rounded border bg-white p-4">
          <label className="block text-sm font-medium mb-1">
            Sucursal a consultar
          </label>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setCart([]);
              setSearch("");
            }}
            className="border rounded px-3 py-2 min-w-[260px]"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>

          <p className="text-sm text-gray-600 mt-2">
            Acceso administrador en modo consulta. Puedes revisar productos y
            stock por sucursal sin afectar la caja del cajero.
          </p>

          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
            <label className="flex items-center gap-3 font-semibold text-amber-900">
              <input
                type="checkbox"
                checked={adminNightTestMode}
                onChange={(e) => setAdminNightTestMode(e.target.checked)}
                className="h-5 w-5"
              />
              Modo prueba nocturna
            </label>

            <p className="mt-1 text-sm text-amber-800">
              Solo visible para administrador. Simula horario 23:30 para revisar
              precio nocturno de cerveza sin afectar cajeros, caja ni ventas.
            </p>
          </div>
        </div>
      )}

      {adminNoticeMessage && (
        <div className="mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-base text-blue-800 font-medium">
          {adminNoticeMessage}
        </div>
      )}

      {pricedCartSummary.nightPricingActive && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-800 font-medium">
          {adminNightPricingTestActive
            ? "Modo prueba nocturna activo: simulando horario 23:30 para validar precios de cerveza. No afecta cajeros, caja ni ventas."
            : "Horario nocturno activo: la cerveza se cobra por pieza con incremento nocturno y no aplica promociÃ³n ni six."}
        </div>
      )}

      {!adminReadOnlyMode && cashStatusLoading && (
        <div className="mb-4 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 font-medium">
          Verificando estatus de caja...
        </div>
      )}

      {!adminReadOnlyMode && cashWithdrawalBlocked && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800 font-semibold">
          Ventas bloqueadas temporalmente: ya hay{" "}
          ${cashAvailableForWithdrawal.toFixed(2)} disponibles para retiro,
          superando el umbral de ${WITHDRAWAL_THRESHOLD_MXN.toFixed(2)}{" "}
          generados por dinero fÃ­sico en caja. Debe realizarse el retiro antes
          de continuar.
        </div>
      )}

      {!adminReadOnlyMode &&
        !cashWithdrawalBlocked &&
        cashAvailableForWithdrawal > 0 && (
          <div className="mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800 font-medium">
            Disponible para retiro: ${cashAvailableForWithdrawal.toFixed(2)} MXN
            generados por dinero fÃ­sico en caja.
          </div>
        )}

      {!adminReadOnlyMode && (
        <div className="mb-4 flex gap-3">
          <button
            className="bg-amber-600 text-white px-4 py-3 rounded text-lg font-semibold disabled:opacity-50"
            onClick={() => setIsWithdrawalOpen(true)}
            disabled={
              cashAvailableForWithdrawal <= 0 ||
              cashStatusLoading ||
              !!ticket ||
              !!withdrawalTicket
            }
          >
            Registrar retiro
          </button>
        </div>
      )}

      <input
        ref={searchRef}
        type="text"
        placeholder="Escanear o buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleScannerEnter();
        }}
        className="border w-full p-4 mb-4 text-2xl rounded"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`px-4 py-3 border rounded text-lg font-medium ${
              selectedCategory === cat ? "bg-blue-600 text-white" : ""
            }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mb-4 text-sm text-gray-500">
        {adminReadOnlyMode
          ? "Modo administrador: consulta de productos y stock por sucursal."
          : "Atajos: F12 o Ctrl + Alt + C para cobro | F1 o Ctrl + Alt + I para imprimir ticket"}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((p) => (
            <button
              key={p.product_id}
              className={`border rounded p-5 text-left ${
                adminReadOnlyMode
                  ? "cursor-default bg-white"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => addProductToCart(p)}
            >
              <div className="font-bold text-2xl leading-tight">{p.name}</div>
              <div className="text-xl mt-2">${p.price}</div>

              {adminNightPricingTestActive && p.category === "CERVEZA" && (
                <div className="text-sm text-amber-700 font-semibold mt-2">
                  Precio nocturno prueba: ${(p.price * 1.35).toFixed(2)}
                </div>
              )}

              {showStock && (
                <div className="text-base text-gray-500 mt-2">
                  Stock: {p.stock}
                </div>
              )}

              {adminReadOnlyMode && (
                <div className="text-xs text-blue-600 mt-2 font-medium">
                  Consulta administrador
                </div>
              )}
            </button>
          ))}

          {filteredProducts.length === 0 && (
            <div className="border rounded p-5 text-gray-500 bg-white">
              No hay productos para mostrar en esta sucursal o bÃºsqueda.
            </div>
          )}
        </div>

        <div className="border rounded bg-white lg:sticky lg:top-4 self-start lg:max-h-[calc(100dvh-8rem)] flex flex-col overflow-hidden">
          <div className="p-4 border-b shrink-0">
            <h2 className="text-3xl font-bold">Carrito</h2>
          </div>

          <div className="p-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
            {adminReadOnlyMode && (
              <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Las ventas estÃ¡n deshabilitadas para el usuario administrador.
              </div>
            )}

            {pricedCartSummary.items.map((c, index) => (
              <div
                key={`${c.product_id}-${c.pricing_type}-${c.promo_name || "base"}-${index}`}
                className="mb-4 border-b pb-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-xl leading-tight">
                      {c.name}
                    </div>

                    <div className="text-base text-gray-600 mt-1">
                      {c.quantity} x ${c.unit_price.toFixed(2)}
                    </div>

                    {c.pricing_type === "promo" && c.promo_name && (
                      <div className="text-sm text-green-700 font-semibold mt-2">
                        Promo aplicada: {c.promo_name}
                      </div>
                    )}

                    {c.pricing_type === "night" && (
                      <div className="text-sm text-amber-700 font-semibold mt-2">
                        Precio nocturno
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-xl">
                      ${c.subtotal.toFixed(2)}
                    </div>

                    {!adminReadOnlyMode && (
                      <div className="flex items-center gap-2 mt-3 justify-end">
                        <button
                          className="bg-gray-300 px-3 py-2 rounded text-lg font-bold min-w-[44px]"
                          onClick={() => changeQuantity(c.product_id, -1)}
                        >
                          -
                        </button>

                        <button
                          className="bg-gray-300 px-3 py-2 rounded text-lg font-bold min-w-[44px]"
                          onClick={() => changeQuantity(c.product_id, 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {pricedCartSummary.items.length === 0 && (
              <div className="text-base text-gray-500">
                Sin productos en carrito
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-white shrink-0">
            <div className="text-4xl font-bold">
              Total: ${total.toFixed(2)}
            </div>

            <button
              className="bg-blue-600 text-white px-4 py-4 mt-4 w-full text-2xl rounded font-semibold disabled:opacity-50"
              onClick={() => setIsPaymentOpen(true)}
              disabled={
                adminReadOnlyMode ||
                cart.length === 0 ||
                cashWithdrawalBlocked ||
                cashStatusLoading ||
                !canOperateSales
              }
            >
              Cobrar
            </button>

            <button
              className="bg-red-600 text-white px-4 py-4 mt-3 w-full text-xl rounded font-semibold disabled:opacity-50"
              onClick={clearCart}
              disabled={cart.length === 0 || adminReadOnlyMode}
            >
              Vaciar carrito
            </button>
          </div>
        </div>
      </div>

      <PaymentModal
        open={isPaymentOpen}
        total={total}
        exchangeRate={exchangeRate || 1}
        onClose={() => setIsPaymentOpen(false)}
        onConfirm={handleConfirmSale}
      />

      <WithdrawalModal
        open={isWithdrawalOpen}
        maxAmount={cashAvailableForWithdrawal}
        onClose={() => setIsWithdrawalOpen(false)}
        onConfirm={handleConfirmWithdrawal}
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

      {withdrawalTicket && (
        <WithdrawalTicketModal
          ticket={withdrawalTicket}
          onClose={() => {
            setWithdrawalTicket(null);
            focusSearch();
          }}
        />
      )}
    </div>
  );
}

function WithdrawalModal({
  open,
  maxAmount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  maxAmount: number;
  onClose: () => void;
  onConfirm: (
    amount: string,
    reason: string,
    cashBreakdown: CashBreakdownItem[],
    breakdownTotal: number
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState("Retiro de efectivo");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [otherAmount, setOtherAmount] = useState("");

  const denominations = [1000, 500, 200, 100, 50, 20];

  const cashBreakdown = denominations
    .map((denomination) => {
      const quantity = Number(quantities[denomination] || 0);
      const subtotal = round2(denomination * quantity);

      return {
        label: `$${denomination}`,
        denomination,
        quantity,
        subtotal,
      };
    })
    .filter((item) => item.quantity > 0);

  const otherValue = Number(otherAmount) || 0;

  if (otherValue > 0) {
    cashBreakdown.push({
      label: "Monedas / otros",
      denomination: 1,
      quantity: 1,
      subtotal: round2(otherValue),
    });
  }

  const breakdownTotal = round2(
    cashBreakdown.reduce((acc, item) => acc + Number(item.subtotal || 0), 0)
  );

  const isOverAvailable = breakdownTotal > maxAmount;

  useEffect(() => {
    if (open) {
      setReason("Retiro de efectivo");
      setQuantities({});
      setOtherAmount("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Registrar retiro</h2>

        <div className="text-sm text-gray-600 mb-4">
          Disponible para retiro:{" "}
          <span className="font-semibold">${maxAmount.toFixed(2)}</span>
        </div>

        <div className="mb-4 rounded border bg-gray-50 p-3">
          <div className="font-semibold mb-3">Desglose de efectivo retirado</div>

          <div className="grid grid-cols-2 gap-2">
            {denominations.map((denomination) => {
              const quantity = Number(quantities[denomination] || 0);
              const subtotal = denomination * quantity;

              return (
                <div key={denomination}>
                  <label className="block text-xs text-gray-600 mb-1">
                    ${denomination}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="border w-full p-2 rounded"
                    value={quantities[denomination] || ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [denomination]: e.target.value,
                      }))
                    }
                  />
                  {quantity > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      ${subtotal.toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">
              Monedas / otros
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="border w-full p-2 rounded"
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value)}
            />
          </div>

          <div className="mt-3 flex justify-between text-sm font-semibold">
            <span>Total del desglose</span>
            <span
              className={isOverAvailable ? "text-red-600" : "text-green-700"}
            >
              ${breakdownTotal.toFixed(2)}
            </span>
          </div>

          {isOverAvailable && (
            <div className="mt-2 text-xs text-red-600">
              El total del desglose no puede ser mayor al disponible para retiro.
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder="Motivo"
          className="border w-full p-3 mb-4 rounded"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="bg-black text-white px-4 py-3 rounded w-full disabled:opacity-50"
            disabled={breakdownTotal <= 0 || isOverAvailable}
            onClick={() =>
              onConfirm(
                String(breakdownTotal),
                reason,
                cashBreakdown,
                breakdownTotal
              )
            }
          >
            Confirmar retiro
          </button>

          <button className="border px-4 py-3 rounded w-full" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
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
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrintShortcut =
        event.key === "F1" ||
        (event.ctrlKey && event.altKey && event.key.toLowerCase() === "i");

      if (isPrintShortcut) {
        event.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const subtotalItems = ticket.items.reduce(
    (acc, item) => acc + Number(item.subtotal || 0),
    0
  );

  const totalPagado =
    Number(ticket.payment.payment_cash || 0) +
    Number(ticket.payment.payment_card || 0) +
    Number(ticket.payment.payment_usd || 0) * Number(ticket.exchangeRate || 1);

  const cambio = totalPagado - subtotalItems;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={beerZoneLogo}
            alt="Beer Zone marca de agua"
            className="w-64 opacity-5 object-contain"
          />
        </div>

        <div className="relative z-10">
          <div className="text-center mb-4">
            <img
              src={beerZoneLogo}
              alt="Beer Zone"
              className="mx-auto h-20 object-contain mb-2"
            />
            <h2 className="text-2xl font-bold">BEER ZONE</h2>
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
            {ticket.items.map((item, index) => (
              <div
                key={`${item.product_id}-${item.pricing_type}-${
                  item.promo_name || "base"
                }-${index}`}
                className="mb-2 text-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    {item.name} x{item.quantity}
                  </div>
                  <div>${Number(item.subtotal || 0).toFixed(2)}</div>
                </div>

                {item.pricing_type === "promo" && item.promo_name && (
                  <div className="text-xs text-green-700">
                    {item.promo_name}
                  </div>
                )}

                {item.pricing_type === "night" && (
                  <div className="text-xs text-amber-700">Precio nocturno</div>
                )}
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

          <div className="mb-4 text-center text-xs text-gray-700 leading-relaxed">
            El reembolso del importe de su compra es vÃ¡lido Ãºnicamente dentro de
            las primeras 24 horas posteriores a la fecha de compra.
          </div>

          <div className="mb-3 text-center text-xs text-gray-500">
            Atajo: F1 o Ctrl + Alt + I para imprimir
          </div>

          <div className="flex gap-2">
            <button
              className="bg-black text-white px-4 py-2 rounded w-full"
              onClick={() => window.print()}
            >
              Imprimir
            </button>

            <button className="border px-4 py-2 rounded w-full" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawalTicketModal({
  ticket,
  onClose,
}: {
  ticket: WithdrawalTicketData;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPrintShortcut =
        event.key === "F1" ||
        (event.ctrlKey && event.altKey && event.key.toLowerCase() === "i");

      if (isPrintShortcut) {
        event.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={beerZoneLogo}
            alt="Beer Zone marca de agua"
            className="w-64 opacity-5 object-contain"
          />
        </div>

        <div className="relative z-10">
          <div className="text-center mb-4">
            <img
              src={beerZoneLogo}
              alt="Beer Zone"
              className="mx-auto h-20 object-contain mb-2"
            />
            <h2 className="text-2xl font-bold">BEER ZONE</h2>
            <p className="text-sm font-medium">TICKET DE RETIRO</p>
          </div>

          <div className="mb-4 text-sm space-y-1">
            <div>
              <span className="font-semibold">Folio:</span> {ticket.id}
            </div>
            <div>
              <span className="font-semibold">SesiÃ³n:</span> {ticket.sessionId}
            </div>
            <div>
              <span className="font-semibold">Fecha:</span>{" "}
              {new Date(ticket.createdAt).toLocaleString()}
            </div>
            <div>
              <span className="font-semibold">Sucursal:</span>{" "}
              {ticket.storeName}
            </div>
            <div>
              <span className="font-semibold">Cajero:</span>{" "}
              {ticket.cashierName}
            </div>
          </div>

          <div className="border-t border-b py-3 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span>Monto retirado</span>
              <span>${ticket.amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>Motivo</span>
              <span className="text-right max-w-[60%]">{ticket.reason}</span>
            </div>

            {ticket.cashBreakdown.length > 0 && (
              <div className="pt-2">
                <div className="font-semibold mb-1">Desglose</div>

                <div className="space-y-1">
                  {ticket.cashBreakdown.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="flex justify-between"
                    >
                      <span>
                        {item.label}
                        {item.label === "Monedas / otros"
                          ? ""
                          : ` x ${item.quantity}`}
                      </span>
                      <span>${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-semibold pt-2">
                  <span>Total desglose</span>
                  <span>${ticket.breakdownTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between font-semibold pt-2">
              <span>Disponible despuÃ©s del retiro</span>
              <span>${ticket.availableAfterWithdrawal.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center text-xs mb-4">OPTICODE LABS</div>

          <div className="mb-3 text-center text-xs text-gray-500">
            Atajo: F1 o Ctrl + Alt + I para imprimir
          </div>

          <div className="flex gap-2">
            <button
              className="bg-black text-white px-4 py-2 rounded w-full"
              onClick={() => window.print()}
            >
              Imprimir
            </button>

            <button className="border px-4 py-2 rounded w-full" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}