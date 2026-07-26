import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { downloadExcel } from "@/lib/export";

type Store = {
  id: string;
  name: string;
};

type ProductInfo = {
  id: string;
  name: string;
  cost: number;
};

type ProductReportRow = {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  total_sales: number;
  total_cost: number;
  profit: number;
};

type StoreReportRow = {
  store_id: string;
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
  difference: number;
  transactions: number;
};

type LossMovementRow = {
  id: string;
  created_at: string;
  quantity: number;
  reason: string | null;
  product_id: string;
  store_id: string;
};

type LossRow = {
  id: string;
  created_at: string;
  quantity: number;
  reason: string | null;
  product_name: string;
  store_name: string;
  cost: number;
};

type InventoryStatus = "Disponible" | "Bajo mínimo" | "Sin stock";

type InventoryReportRow = {
  id: string;
  product_id: string;
  store_id: string;
  product_name: string;
  sku: string;
  store_name: string;
  stock: number;
  min_stock: number;
  status: InventoryStatus;
};

type ReportFilters = {
  fromValue: string;
  toValue: string;
  storeIdValue: string;
  cashierValue: string;
};

function formatLocalDateTimeInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

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
  const [inventoryRows, setInventoryRows] = useState<InventoryReportRow[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [loadingLoss, setLoadingLoss] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [showProducts, setShowProducts] = useState(false);
  const [showStores, setShowStores] = useState(false);
  const [showCashiers, setShowCashiers] = useState(false);
  const [showLoss, setShowLoss] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  useEffect(() => {
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 0, 0);

    setFrom(formatLocalDateTimeInput(start));
    setTo(formatLocalDateTimeInput(end));

    loadStores();
  }, []);

  useEffect(() => {
    loadCashierOptions();
  }, [from, to, storeFilter]);

  useEffect(() => {
    if (!from || !to) return;
    loadKpisData();
  }, [from, to, storeFilter, cashierFilter]);

  function buildRpcParams({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: ReportFilters) {
    return {
      p_from: new Date(fromValue).toISOString(),
      p_to: new Date(toValue).toISOString(),
      p_store_id: storeIdValue === "all" ? null : storeIdValue,
      p_cashier: cashierValue === "all" ? null : cashierValue,
    };
  }

  async function loadStores() {
    const { data, error } = await supabase
      .from("pos_stores")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setStores([]);
      return;
    }

    setStores(
      ((data || []) as any[]).map((store) => ({
        id: String(store.id),
        name: String(store.name || "Sucursal").trim(),
      }))
    );
  }

  async function loadCashierOptions() {
    if (!from || !to) return;

    const rows = await fetchCashierReportRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: "all",
    });

    const options = Array.from(
      new Set(
        rows
          .map((row) => String(row.cashier || "").trim())
          .filter((name) => name.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    setCashierOptions(options);

    if (cashierFilter !== "all" && !options.includes(cashierFilter)) {
      setCashierFilter("all");
    }
  }

  async function fetchProductRows({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: ReportFilters): Promise<ProductReportRow[]> {
    const { data, error } = await supabase.rpc(
      "get_report_sales_by_product_filtered",
      buildRpcParams({
        fromValue,
        toValue,
        storeIdValue,
        cashierValue,
      })
    );

    if (error) {
      console.error(error);
      return [];
    }

    return ((data || []) as any[])
      .map((row) => ({
        product_id: String(row.product_id || ""),
        product_name: String(row.product_name || "Producto").trim(),
        quantity_sold: Number(row.quantity_sold || 0),
        total_sales: Number(row.total_sales || 0),
        total_cost: Number(row.total_cost || 0),
        profit: Number(row.profit || 0),
      }))
      .sort((a, b) => b.total_sales - a.total_sales);
  }

  async function fetchStoreReportRows({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: ReportFilters): Promise<StoreReportRow[]> {
    const { data, error } = await supabase.rpc(
      "get_report_sales_by_store_filtered",
      buildRpcParams({
        fromValue,
        toValue,
        storeIdValue,
        cashierValue,
      })
    );

    if (error) {
      console.error(error);
      return [];
    }

    return ((data || []) as any[])
      .map((row) => ({
        store_id: String(row.store_id || ""),
        store_name: String(row.store_name || "Sucursal").trim(),
        total_sales: Number(row.total_sales || 0),
        total_cash: Number(row.total_cash || 0),
        total_card: Number(row.total_card || 0),
        total_usd: Number(row.total_usd || 0),
      }))
      .sort((a, b) => b.total_sales - a.total_sales);
  }

  async function fetchCashierReportRows({
    fromValue,
    toValue,
    storeIdValue,
    cashierValue,
  }: ReportFilters): Promise<CashierReportRow[]> {
    const { data, error } = await supabase.rpc(
      "get_report_sales_by_cashier_filtered",
      buildRpcParams({
        fromValue,
        toValue,
        storeIdValue,
        cashierValue,
      })
    );

    if (error) {
      console.error(error);
      return [];
    }

    return ((data || []) as any[])
      .map((row) => ({
        cashier: String(row.cashier || "Sin nombre").trim(),
        total_sales: Number(row.total_sales || 0),
        total_cash: Number(row.total_cash || 0),
        total_card: Number(row.total_card || 0),
        total_usd: Number(row.total_usd || 0),
        difference: Number(row.difference || 0),
        transactions: Number(row.transactions || 0),
      }))
      .sort((a, b) => b.total_sales - a.total_sales);
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

    const storeIds = Array.from(
      new Set(filteredLoss.map((r) => String(r.store_id || "")))
    ).filter((id) => id.length > 0);

    const [{ data: productsData }, { data: storesData }] = await Promise.all([
      supabase.from("products").select("id, name, cost").in("id", productIds),
      supabase.from("pos_stores").select("id, name").in("id", storeIds),
    ]);

    const productMap = new Map<string, ProductInfo>(
      ((productsData || []) as any[]).map((product) => [
        String(product.id),
        {
          id: String(product.id),
          name: String(product.name || "Producto").trim(),
          cost: Number(product.cost || 0),
        },
      ])
    );

    const storeMap = new Map<string, string>(
      ((storesData || []) as any[]).map((store) => [
        String(store.id),
        String(store.name || "Sucursal").trim(),
      ])
    );

    return filteredLoss.map((r) => {
      const product = productMap.get(String(r.product_id || ""));
      const storeName = storeMap.get(String(r.store_id || "")) || "Sucursal";

      return {
        id: String(r.id),
        quantity: Math.abs(Number(r.quantity || 0)),
        reason: r.reason,
        created_at: r.created_at,
        product_name: product?.name || "Producto",
        store_name: storeName,
        cost: Number(product?.cost || 0),
      };
    });
  }

  async function fetchInventoryRows(
    storeIdValue: string
  ): Promise<InventoryReportRow[]> {
    let query = supabase.from("inventory").select(`
        id,
        product_id,
        store_id,
        stock,
        min_stock,
        products!inner (
          name,
          sku
        ),
        pos_stores (
          name
        )
      `);

    if (storeIdValue !== "all") {
      query = query.eq("store_id", storeIdValue);
    }

    const { data, error } = await query.order("store_id", {
      ascending: true,
    });

    if (error) {
      console.error("Error loading inventory report:", error);
      return [];
    }

    return ((data || []) as any[])
      .map((row) => {
        const stock = Number(row.stock || 0);
        const minStock = Number(row.min_stock || 0);

        return {
          id: String(row.id || ""),
          product_id: String(row.product_id || ""),
          store_id: String(row.store_id || ""),
          product_name: String(row.products?.name || "Producto").trim(),
          sku: String(row.products?.sku || "").trim(),
          store_name: String(row.pos_stores?.name || "Sucursal").trim(),
          stock,
          min_stock: minStock,
          status: getInventoryStatus(stock, minStock),
        };
      })
      .sort((a, b) => {
        const storeComparison = a.store_name.localeCompare(b.store_name);

        if (storeComparison !== 0) {
          return storeComparison;
        }

        return a.product_name.localeCompare(b.product_name);
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

    const rows = await fetchStoreReportRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

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

    const rows = await fetchCashierReportRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

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

  async function loadInventoryReport() {
    if (showInventory) {
      setShowInventory(false);
      return;
    }

    setLoadingInventory(true);

    const rows = await fetchInventoryRows(storeFilter);

    setInventoryRows(rows);
    setShowInventory(true);
    setLoadingInventory(false);
  }

  const kpis = useMemo(() => {
    const ventas = productRows.reduce(
      (a, b) => a + Number(b.total_sales || 0),
      0
    );

    const costo = productRows.reduce(
      (a, b) => a + Number(b.total_cost || 0),
      0
    );

    const utilidad = productRows.reduce(
      (a, b) => a + Number(b.profit || 0),
      0
    );

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

  async function handleExport() {
    if (!from || !to) return;

    const [products, storesReport, cashiersReport, losses, inventory] =
      await Promise.all([
        fetchProductRows({
          fromValue: from,
          toValue: to,
          storeIdValue: storeFilter,
          cashierValue: cashierFilter,
        }),
        fetchStoreReportRows({
          fromValue: from,
          toValue: to,
          storeIdValue: storeFilter,
          cashierValue: cashierFilter,
        }),
        fetchCashierReportRows({
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
        fetchInventoryRows(storeFilter),
      ]);

    const rows = [
      ...products.map((p) => ({
        Seccion: "Ventas por Producto",
        Producto: p.product_name,
        Cantidad_Neta: p.quantity_sold,
        Venta_Neta: p.total_sales,
        Costo_Neto: p.total_cost,
        Utilidad_Neta: p.profit,
      })),
      ...storesReport.map((s) => ({
        Seccion: "Ventas por Sucursal",
        Sucursal: s.store_name,
        Venta_Neta: s.total_sales,
        Efectivo_MXN_Neto: s.total_cash,
        Tarjeta_MXN_Neto: s.total_card,
        USD_Neto: s.total_usd,
      })),
      ...cashiersReport.map((c) => ({
        Seccion: "Ventas por Cajero",
        Cajero: c.cashier,
        Venta_Neta: c.total_sales,
        Efectivo_MXN_Neto: c.total_cash,
        Tarjeta_MXN_Neto: c.total_card,
        USD_Neto: c.total_usd,
        Diferencia_MXN: c.difference,
        Estado_Diferencia: getDifferenceLabel(c.difference),
        Transacciones_Netas: c.transactions,
      })),
      ...losses.map((l) => ({
        Seccion: "Merma",
        Producto: l.product_name,
        Cantidad: l.quantity,
        Motivo: l.reason,
        Sucursal: l.store_name,
        Fecha: new Date(l.created_at).toLocaleString(),
      })),
      ...inventory.map((item) => ({
        Seccion: "Inventario",
        Sucursal: item.store_name,
        Producto: item.product_name,
        SKU: item.sku,
        Stock_Actual: item.stock,
        Stock_Minimo: item.min_stock,
        Estado: item.status,
      })),
    ];

    downloadExcel("reporte_general.xlsx", rows);
  }

  async function handleExportProducts() {
    if (!from || !to) return;

    const rows = await fetchProductRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    downloadExcel(
      "ventas_por_producto.xlsx",
      rows.map((p) => ({
        Producto: p.product_name,
        Cantidad_Neta: p.quantity_sold,
        Venta_Neta: p.total_sales,
        Costo_Neto: p.total_cost,
        Utilidad_Neta: p.profit,
      }))
    );
  }

  async function handleExportStores() {
    if (!from || !to) return;

    const rows = await fetchStoreReportRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    downloadExcel(
      "ventas_por_sucursal.xlsx",
      rows.map((s) => ({
        Sucursal: s.store_name,
        Venta_Neta: s.total_sales,
        Efectivo_MXN_Neto: s.total_cash,
        Tarjeta_MXN_Neto: s.total_card,
        USD_Neto: s.total_usd,
      }))
    );
  }

  async function handleExportCashiers() {
    if (!from || !to) return;

    const rows = await fetchCashierReportRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
      cashierValue: cashierFilter,
    });

    downloadExcel(
      "ventas_por_cajero.xlsx",
      rows.map((c) => ({
        Cajero: c.cashier,
        Venta_Neta: c.total_sales,
        Efectivo_MXN_Neto: c.total_cash,
        Tarjeta_MXN_Neto: c.total_card,
        USD_Neto: c.total_usd,
        Diferencia_MXN: c.difference,
        Estado_Diferencia: getDifferenceLabel(c.difference),
        Transacciones_Netas: c.transactions,
      }))
    );
  }

  async function handleExportLoss() {
    if (!from || !to) return;

    const rows = await fetchLossRows({
      fromValue: from,
      toValue: to,
      storeIdValue: storeFilter,
    });

    downloadExcel(
      "reporte_merma.xlsx",
      rows.map((l) => ({
        Producto: l.product_name,
        Cantidad: l.quantity,
        Motivo: l.reason,
        Sucursal: l.store_name,
        Fecha: new Date(l.created_at).toLocaleString(),
      }))
    );
  }

  async function handleExportInventory() {
    const rows = await fetchInventoryRows(storeFilter);

    downloadExcel(
      "reporte_inventario.xlsx",
      rows.map((item) => ({
        Sucursal: item.store_name,
        Producto: item.product_name,
        SKU: item.sku,
        Stock_Actual: item.stock,
        Stock_Minimo: item.min_stock,
        Estado: item.status,
      }))
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reportes</h1>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card title="Ventas Netas" value={kpis.ventas} />
        <Card title="Costo Neto" value={kpis.costo} />
        <Card title="Utilidad Bruta Neta" value={kpis.utilidad} />
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
          onClick={() => void handleExport()}
          className="border px-4 py-2 rounded hover:bg-gray-50"
        >
          Exportar Excel
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded mb-6">
        <p className="font-semibold">{reportContextLabel}</p>

        <p className="text-sm mt-1">
          Los KPIs y reportes se calculan como ventas netas, descontando
          cancelaciones completas, devoluciones parciales, devoluciones completas
          y merma según los filtros seleccionados. La diferencia física de cierre compara el efectivo declarado por el cajero contra el efectivo esperado de la sesión.
          El reporte de inventario muestra existencias actuales y usa únicamente
          el filtro de sucursal.
        </p>
      </div>

      <ReportHeader
        title="Ventas por Producto"
        onConsult={loadProducts}
        onExport={handleExportProducts}
      />

      {showProducts && (
        <TableProducts rows={productRows} loading={loadingProducts} />
      )}

      <ReportHeader
        title="Ventas por Sucursal"
        onConsult={loadStoresReport}
        onExport={handleExportStores}
      />

      {showStores && (
        <TableStores rows={storeRows} loading={loadingStores} />
      )}

      <ReportHeader
        title="Ventas por Cajero"
        onConsult={loadCashiersReport}
        onExport={handleExportCashiers}
      />

      {showCashiers && (
        <TableCashiers rows={cashierRows} loading={loadingCashiers} />
      )}

      <ReportHeader
        title="Reporte de Merma"
        onConsult={loadLossReport}
        onExport={handleExportLoss}
      />

      {showLoss && <TableLoss rows={lossRows} loading={loadingLoss} />}

      <ReportHeader
        title="Reporte de Inventario"
        onConsult={loadInventoryReport}
        onExport={handleExportInventory}
      />

      {showInventory && (
        <TableInventory rows={inventoryRows} loading={loadingInventory} />
      )}
    </div>
  );
}

function ReportHeader({
  title,
  onConsult,
  onExport,
}: {
  title: string;
  onConsult: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
}) {
  return (
    <div className="bg-white p-4 rounded shadow mb-2 flex justify-between items-center">
      <h2 className="font-semibold">{title}</h2>

      <div className="flex gap-2">
        <button
          onClick={() => void onConsult()}
          className="bg-black text-white px-3 py-1 rounded hover:bg-gray-800"
        >
          Consultar
        </button>

        <button
          onClick={() => void onExport()}
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
    <div className="bg-white p-4 rounded shadow mb-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Producto</th>
            <th className="text-center">Cantidad Neta</th>
            <th className="text-center">Venta Neta</th>
            <th className="text-center">Costo Neto</th>
            <th className="text-center">Utilidad Neta</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={r.product_id || i}>
              <td className="text-center">{r.product_name}</td>
              <td className="text-center">{r.quantity_sold}</td>

              <td className="text-center">
                ${Number(r.total_sales || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_cost || 0).toFixed(2)}
              </td>

              <td
                className={`text-center ${
                  Number(r.profit || 0) < 0
                    ? "text-red-600 font-semibold"
                    : ""
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
    <div className="bg-white p-4 rounded shadow mb-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Sucursal</th>
            <th className="text-center">Venta Neta</th>
            <th className="text-center">Efectivo Neto</th>
            <th className="text-center">Tarjeta Neta</th>
            <th className="text-center">USD Neto</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={r.store_id || i}>
              <td className="text-center">{r.store_name}</td>

              <td className="text-center">
                ${Number(r.total_sales || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_cash || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_card || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_usd || 0).toFixed(4)}
              </td>
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
    <div className="bg-white p-4 rounded shadow mb-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Cajero</th>
            <th className="text-center">Venta Neta</th>
            <th className="text-center">Efectivo Neto</th>
            <th className="text-center">Tarjeta Neta</th>
            <th className="text-center">USD Neto</th>
            <th className="text-center">
              Diferencia física de cierre
            </th>
            <th className="text-center">Transacciones Netas</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.cashier}-${i}`}>
              <td className="text-center">{r.cashier}</td>

              <td className="text-center">
                ${Number(r.total_sales || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_cash || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_card || 0).toFixed(2)}
              </td>

              <td className="text-center">
                ${Number(r.total_usd || 0).toFixed(4)}
              </td>

              <td
                className={`text-center font-semibold ${getDifferenceClass(
                  r.difference
                )}`}
              >
                {getDifferenceLabel(r.difference)}
              </td>

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
    <div className="bg-white p-4 rounded shadow mb-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-center">Producto</th>
            <th className="text-center">Cantidad</th>
            <th className="text-center">Motivo</th>
            <th className="text-center">Sucursal</th>
            <th className="text-center">Fecha</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-center">{r.product_name}</td>
              <td className="text-center">{r.quantity}</td>
              <td className="text-center">{r.reason}</td>
              <td className="text-center">{r.store_name}</td>

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

function TableInventory({
  rows,
  loading,
}: {
  rows: InventoryReportRow[];
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
    <div className="bg-white p-4 rounded shadow mb-6 overflow-x-auto">
      <p className="text-sm text-gray-500 mb-4">
        Existencias actuales. Este reporte usa únicamente el filtro de sucursal;
        no depende de la fecha ni del cajero.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay registros de inventario para la sucursal seleccionada.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-center">Sucursal</th>
              <th className="text-center">Producto</th>
              <th className="text-center">SKU</th>
              <th className="text-center">Stock actual</th>
              <th className="text-center">Stock mínimo</th>
              <th className="text-center">Estado</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-center">{r.store_name}</td>
                <td className="text-center">{r.product_name}</td>
                <td className="text-center">{r.sku || "—"}</td>
                <td className="text-center">{r.stock}</td>
                <td className="text-center">{r.min_stock}</td>
                <td
                  className={`text-center font-semibold ${getInventoryStatusClass(
                    r.status
                  )}`}
                >
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function getInventoryStatus(
  stockValue: number,
  minStockValue: number
): InventoryStatus {
  const stock = Number(stockValue || 0);
  const minStock = Number(minStockValue || 0);

  if (stock <= 0) {
    return "Sin stock";
  }

  if (stock <= minStock) {
    return "Bajo mínimo";
  }

  return "Disponible";
}

function getInventoryStatusClass(status: InventoryStatus) {
  if (status === "Sin stock") {
    return "text-red-600";
  }

  if (status === "Bajo mínimo") {
    return "text-amber-600";
  }

  return "text-green-600";
}

function getDifferenceLabel(value: number) {
  const difference = Number(value || 0);

  if (difference > 0) {
    return `Faltante $${difference.toFixed(2)}`;
  }

  if (difference < 0) {
    return `Sobrante $${Math.abs(difference).toFixed(2)}`;
  }

  return "Cuadrado $0.00";
}

function getDifferenceClass(value: number) {
  const difference = Number(value || 0);

  if (difference > 0) {
    return "text-red-600";
  }

  if (difference < 0) {
    return "text-blue-600";
  }

  return "text-green-600";
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold">${value.toFixed(2)}</p>
    </div>
  );
}