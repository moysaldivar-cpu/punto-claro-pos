import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { downloadExcel } from "@/lib/export";

type Store = {
  id: string;
  name: string;
};

type SaleRow = {
  id: string;
  created_at: string;
  total: number;
  payment_cash: number;
  payment_card: number;
  payment_usd: number;
  store_id: string;
  user_name: string | null;
};

type ProductInfo = {
  id: string;
  name: string;
  cost: number;
};

type SalesItemRow = {
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_at_sale: number | null;
};

type ProductReportRow = {
  product_name: string;
  quantity_sold: number;
  total_sales: number;
  total_cost: number;
  profit: number;
};

type StoreReportRow = {
  store_name: string;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_usd: number;
};

type CashierReportRow = {
  cashier: string;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_usd: number;
  transactions: number;
};

type LossMovementRow = {
  id: string;
  created_at: string;
  quantity: number;
  reason: string | null;
  product_id: string;
};

type LossRow = {
  id: string;
  created_at: string;
  quantity: number;
  reason: string | null;
  product_name: string;
  cost: number;
};

export default function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [stores, setStores] = useState<Store[]>([]);
  const [cashierOptions, setCashierOptions] = useState<string[]>([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");

  const [productRows, setProductRows] = useState<ProductReportRow[]>([]);
  const [storeRows, setStoreRows] = useState<StoreReportRow[]>([]);
  const [cashierRows, setCashierRows] = useState<CashierReportRow[]>([]);
  const [lossRows, setLossRows] = useState<LossRow[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [loadingLoss, setLoadingLoss] = useState(false);

  const [showProducts, setShowProducts] = useState(false);
  const [showStores, setShowStores] = useState(false);
  const [showCashiers, setShowCashiers] = useState(false);
  const [showLoss, setShowLoss] = useState(false);

  useEffect(() => {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 0, 0);

    const format = (d: Date) => d.toISOString().slice(0, 16);

    setFrom(format(start));
    setTo(format(end));

    loadStores();
  }, []);

  useEffect(() => {
    loadCashierOptions();
  }, [from, to, storeFilter]);

  useEffect(() => {
    if (!from || !to) return;
    loadKpisData();
  }, [from, to, storeFilter, cashierFilter]);

  async function loadStores() {
    const { data } = await supabase
      .from("pos_stores")
      .select("id,name")
      .order("name", { ascending: true });

    setStores(data || []);
  }

  async function loadCashierOptions() {
    if (!from || !to) return;

    const sales = await fetchFilteredSales({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: "all",
    });

    const options = Array.from(
      new Set(
        sales
          .map((row) => String(row.user_name || "").trim())
          .filter((name) => name.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    setCashierOptions(options);

    if (cashierFilter !== "all" && !options.includes(cashierFilter)) {
      setCashierFilter("all");
    }
  }

  async function fetchFilteredSales({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: {
    fromValue: string;
    toValue: string;
    storeIdValue: string;
    cashierValue: string;
  }) {
    const fromDate = new Date(fromValue).toISOString();
    const toDate = new Date(toValue).toISOString();

    let query = supabase
      .from("sales")
      .select(
        "id, created_at, total, payment_cash, payment_card, payment_usd, store_id, user_name"
      )
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: false });

    if (storeIdValue !== "all") {
      query = query.eq("store_id", storeIdValue);
    }

    if (cashierValue !== "all") {
      query = query.eq("user_name", cashierValue);
    }

    const { data } = await query;

    return (data || []).map((row: any) => ({
      id: row.id,
      created_at: row.created_at,
      total: Number(row.total || 0),
      payment_cash: Number(row.payment_cash || 0),
      payment_card: Number(row.payment_card || 0),
      payment_usd: Number(row.payment_usd || 0),
      store_id: String(row.store_id || ""),
      user_name: row.user_name ? String(row.user_name) : null,
    })) as SaleRow[];
  }

  async function fetchProductRows({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: {
    fromValue: string;
    toValue: string;
    storeIdValue: string;
    cashierValue: string;
  }): Promise<ProductReportRow[]> {
    const sales = await fetchFilteredSales({
      fromValue,
      toValue,
      storeIdValue,
      cashierValue,
    });

    if (sales.length === 0) {
      return [];
    }

    const saleIds = sales.map((sale) => sale.id);

    const { data: itemsData } = await supabase
      .from("sales_items")
      .select("sale_id, product_id, quantity, unit_price, cost_at_sale")
      .in("sale_id", saleIds);

    if (!itemsData || itemsData.length === 0) {
      return [];
    }

    const productIds = Array.from(
      new Set((itemsData || []).map((item: any) => item.product_id))
    );

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, cost")
      .in("id", productIds);

    const productMap = new Map<string, ProductInfo>(
      ((productsData || []) as any[]).map((product) => [
        String(product.id),
        {
          id: String(product.id),
          name: String(product.name || "Producto"),
          cost: Number(product.cost || 0),
        },
      ])
    );

    const grouped = new Map<string, ProductReportRow>();

    ((itemsData || []) as SalesItemRow[]).forEach((item: any) => {
      const productId = String(item.product_id || "");
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const costAtSale =
        item.cost_at_sale === null || item.cost_at_sale === undefined
          ? null
          : Number(item.cost_at_sale);

      const product = productMap.get(productId);
      const unitCost = costAtSale ?? Number(product?.cost || 0);

      const current = grouped.get(productId) || {
        product_name: product?.name || "Producto",
        quantity_sold: 0,
        total_sales: 0,
        total_cost: 0,
        profit: 0,
      };

      current.quantity_sold += quantity;
      current.total_sales += unitPrice * quantity;
      current.total_cost += unitCost * quantity;
      current.profit = current.total_sales - current.total_cost;

      grouped.set(productId, current);
    });

    return Array.from(grouped.values()).sort(
      (a, b) => b.total_sales - a.total_sales
    );
  }

  async function fetchLossRows({
    fromValue,
    toValue,
    storeIdValue,
  }: {
    fromValue: string;
    toValue: string;
    storeIdValue: string;
  }): Promise<LossRow[]> {
    const fromDate = new Date(fromValue).toISOString();
    const toDate = new Date(toValue).toISOString();

    let query = supabase
      .from("inventory_movements")
      .select("id, quantity, reason, created_at, product_id, store_id")
      .eq("type", "out")
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .order("created_at", { ascending: false });

    if (storeIdValue !== "all") {
      query = query.eq("store_id", storeIdValue);
    }

    const { data: loss, error } = await query;

    if (error) {
      console.error(error);
      return [];
    }

    const filteredLoss = ((loss || []) as LossMovementRow[]).filter(
      (r) => String(r.reason || "").trim().length > 0
    );

    if (filteredLoss.length === 0) {
      return [];
    }

    const productIds = Array.from(
      new Set(filteredLoss.map((r) => String(r.product_id || "")))
    ).filter((id) => id.length > 0);

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, cost")
      .in("id", productIds);

    const productMap = new Map<string, ProductInfo>(
      ((productsData || []) as any[]).map((product) => [
        String(product.id),
        {
          id: String(product.id),
          name: String(product.name || "Producto"),
          cost: Number(product.cost || 0),
        },
      ])
    );

    return filteredLoss.map((r) => {
      const product = productMap.get(String(r.product_id || ""));

      return {
        id: String(r.id),
        quantity: Math.abs(Number(r.quantity || 0)),
        reason: r.reason,
        created_at: r.created_at,
        product_name: product?.name || "Producto",
        cost: Number(product?.cost || 0),
      };
    });
  }

  async function loadKpisData() {
    if (!from || !to) return;

    const [products, losses] = await Promise.all([
      fetchProductRows({
        fromValue: from,
        toValue: to,
        storeIdValue: storeFilter,
        cashierValue: cashierFilter,
      }),
      fetchLossRows({
        fromValue: from,
        toValue: to,
        storeIdValue: storeFilter,
      }),
    ]);

    setProductRows(products);
    setLossRows(losses);
  }

  async function loadProducts() {
    if (showProducts) {
      setShowProducts(false);
      return;
    }

    if (!from || !to) return;

    setLoadingProducts(true);

    const rows = await fetchProductRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    setProductRows(rows);
    setShowProducts(true);
    setLoadingProducts(false);
  }

  async function loadStoresReport() {
    if (showStores) {
      setShowStores(false);
      return;
    }

    if (!from || !to) return;

    setLoadingStores(true);

    const sales = await fetchFilteredSales({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    const storeNameMap = new Map<string, string>(
      stores.map((store) => [store.id, store.name])
    );

    const grouped = new Map<string, StoreReportRow>();

    sales.forEach((sale) => {
      const current = grouped.get(sale.store_id) || {
        store_name: storeNameMap.get(sale.store_id) || "Sucursal",
        total_sales: 0,
        total_cash: 0,
        total_card: 0,
        total_usd: 0,
      };

      current.total_sales += Number(sale.total || 0);
      current.total_cash += Number(sale.payment_cash || 0);
      current.total_card += Number(sale.payment_card || 0);
      current.total_usd += Number(sale.payment_usd || 0);

      grouped.set(sale.store_id, current);
    });

    const rows = Array.from(grouped.values()).sort(
      (a, b) => b.total_sales - a.total_sales
    );

    setStoreRows(rows);
    setShowStores(true);
    setLoadingStores(false);
  }

  async function loadCashiersReport() {
    if (showCashiers) {
      setShowCashiers(false);
      return;
    }

    if (!from || !to) return;

    setLoadingCashiers(true);

    const sales = await fetchFilteredSales({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    const grouped = new Map<string, CashierReportRow>();

    sales.forEach((sale) => {
      const cashier = String(sale.user_name || "Sin nombre");

      const current = grouped.get(cashier) || {
        cashier,
        total_sales: 0,
        total_cash: 0,
        total_card: 0,
        total_usd: 0,
        transactions: 0,
      };

      current.total_sales += Number(sale.total || 0);
      current.total_cash += Number(sale.payment_cash || 0);
      current.total_card += Number(sale.payment_card || 0);
      current.total_usd += Number(sale.payment_usd || 0);
      current.transactions += 1;

      grouped.set(cashier, current);
    });

    const rows = Array.from(grouped.values()).sort(
      (a, b) => b.total_sales - a.total_sales
    );

    setCashierRows(rows);
    setShowCashiers(true);
    setLoadingCashiers(false);
  }

  async function loadLossReport() {
    if (showLoss) {
      setShowLoss(false);
      return;
    }

    if (!from || !to) return;

    setLoadingLoss(true);

    const rows = await fetchLossRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
    });

    setLossRows(rows);
    setShowLoss(true);
    setLoadingLoss(false);
  }

  const kpis = useMemo(() => {
    const ventas = productRows.reduce((a, b) => a + Number(b.total_sales || 0), 0);
    const costo = productRows.reduce((a, b) => a + Number(b.total_cost || 0), 0);
    const utilidad = productRows.reduce((a, b) => a + Number(b.profit || 0), 0);

    const merma = lossRows.reduce(
      (a, b) => a + Number(b.cost || 0) * Number(b.quantity || 0),
      0
    );

    const utilidadNeta = utilidad - merma;

    return { ventas, costo, utilidad, merma, utilidadNeta };
  }, [productRows, lossRows]);

  const selectedStoreName =
    storeFilter === "all"
      ? "Todas las sucursales"
      : stores.find((s) => s.id === storeFilter)?.name || "Sucursal";

  const reportContextLabel = useMemo(() => {
    if (storeFilter === "all" && cashierFilter === "all") {
      return "Modo actual: Consolidado general";
    }

    if (storeFilter !== "all" && cashierFilter === "all") {
      return `Modo actual: Sucursal — ${selectedStoreName}`;
    }

    if (storeFilter === "all" && cashierFilter !== "all") {
      return `Modo actual: Todas las sucursales / Cajero — ${cashierFilter}`;
    }

    return `Modo actual: Sucursal — ${selectedStoreName} / Cajero — ${cashierFilter}`;
  }, [storeFilter, cashierFilter, selectedStoreName]);

  function handleExport() {
    const rows = [
      ...productRows.map((p) => ({
        Tipo: "Venta",
        Producto: p.product_name,
        Cantidad: p.quantity_sold,
        Total: p.total_sales,
        Costo: p.total_cost,
        Utilidad: p.profit,
      })),
      ...lossRows.map((l) => ({
        Tipo: "Merma",
        Producto: l.product_name,
        Cantidad: l.quantity,
        Motivo: l.reason,
        Fecha: new Date(l.created_at).toLocaleString(),
      })),
    ];

    downloadExcel("reporte.xlsx", rows);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card title="Ventas" value={kpis.ventas} />
        <Card title="Costo" value={kpis.costo} />
        <Card title="Utilidad" value={kpis.utilidad} />
        <Card title="Merma" value={kpis.merma} />
        <Card title="Utilidad Neta" value={kpis.utilidadNeta} />
      </div>

      <div className="bg-white p-4 rounded shadow mb-6 flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-sm">Inicio</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="text-sm">Fin</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="text-sm">Sucursal</label>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">Todas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm">Cajero</label>
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="all">Todos</option>
            {cashierOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExport}
          className="border px-4 py-2 rounded hover:bg-gray-50"
        >
          Exportar Excel
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded mb-6">
        <p className="font-semibold">{reportContextLabel}</p>
        <p className="text-sm mt-1">
          Los KPIs y reportes se calculan con base en los filtros seleccionados de
          fecha, sucursal y cajero.
        </p>
      </div>

      <ReportHeader
        title="Ventas por Producto"
        onConsult={loadProducts}
        onExport={handleExport}
      />
      {showProducts && <TableProducts rows={productRows} loading={loadingProducts} />}

      <ReportHeader
        title="Ventas por Sucursal"
        onConsult={loadStoresReport}
        onExport={handleExport}
      />
      {showStores && <TableStores rows={storeRows} loading={loadingStores} />}

      <ReportHeader
        title="Ventas por Cajero"
        onConsult={loadCashiersReport}
        onExport={handleExport}
      />
      {showCashiers && (
        <TableCashiers rows={cashierRows} loading={loadingCashiers} />
      )}

      <ReportHeader
        title="Reporte de Merma"
        onConsult={loadLossReport}
        onExport={handleExport}
      />
      {showLoss && <TableLoss rows={lossRows} loading={loadingLoss} />}
    </div>
  );
}

function ReportHeader({
  title,
  onConsult,
  onExport,
}: {
  title: string;
  onConsult: () => void;
  onExport: () => void;
}) {
  return (
    <div className="bg-white p-4 rounded shadow mb-2 flex justify-between items-center">
      <h2 className="font-semibold">{title}</h2>

      <div className="flex gap-2">
        <button
          onClick={onConsult}
          className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800"
        >
          Consultar
        </button>

        <button
          onClick={onExport}
          className="border px-3 py-1 rounded hover:bg-gray-50"
        >
          Exportar Excel
        </button>
      </div>
    </div>
  );
}

function TableProducts({
  rows,
  loading,
}: {
  rows: ProductReportRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white p-4 rounded shadow mb-6">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Producto</th>
            <th className="text-center">Cantidad</th>
            <th className="text-center">Ventas</th>
            <th className="text-center">Costo</th>
            <th className="text-center">Utilidad</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-center">{r.product_name}</td>
              <td className="text-center">{r.quantity_sold}</td>
              <td className="text-center">${Number(r.total_sales || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_cost || 0).toFixed(2)}</td>
              <td
                className={`text-center ${
                  Number(r.profit || 0) < 0 ? "text-red-600 font-semibold" : ""
                }`}
              >
                ${Number(r.profit || 0).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableStores({
  rows,
  loading,
}: {
  rows: StoreReportRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white p-4 rounded shadow mb-6">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Sucursal</th>
            <th className="text-center">Ventas</th>
            <th className="text-center">Efectivo</th>
            <th className="text-center">Tarjeta</th>
            <th className="text-center">USD</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-center">{r.store_name}</td>
              <td className="text-center">${Number(r.total_sales || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_cash || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_card || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_usd || 0).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableCashiers({
  rows,
  loading,
}: {
  rows: CashierReportRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white p-4 rounded shadow mb-6">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Cajero</th>
            <th className="text-center">Ventas</th>
            <th className="text-center">Efectivo</th>
            <th className="text-center">Tarjeta</th>
            <th className="text-center">USD</th>
            <th className="text-center">Transacciones</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="text-center">{r.cashier}</td>
              <td className="text-center">${Number(r.total_sales || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_cash || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_card || 0).toFixed(2)}</td>
              <td className="text-center">${Number(r.total_usd || 0).toFixed(4)}</td>
              <td className="text-center">{r.transactions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableLoss({
  rows,
  loading,
}: {
  rows: LossRow[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white p-4 rounded shadow mb-6">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Producto</th>
            <th className="text-center">Cantidad</th>
            <th className="text-center">Motivo</th>
            <th className="text-center">Fecha</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-center">{r.product_name}</td>
              <td className="text-center">{r.quantity}</td>
              <td className="text-center">{r.reason}</td>
              <td className="text-center">
                {new Date(r.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold">${value.toFixed(2)}</p>
    </div>
  );
}