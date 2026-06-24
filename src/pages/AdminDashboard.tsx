import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type KPI = {
  salesToday: number;
  transactionsToday: number;
  cashStatus: "open" | "closed";
  lowStockCount: number;
};

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [kpi, setKpi] = useState<KPI>({
    salesToday: 0,
    transactionsToday: 0,
    cashStatus: "closed",
    lowStockCount: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKpis();
  }, []);

  async function loadKpis() {
    setLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: salesToday } = await supabase
      .from("sales")
      .select("total")
      .gte("created_at", todayISO);

    const salesTodayTotal =
      salesToday?.reduce(
        (sum: number, s: any) => sum + (s.total ?? 0),
        0
      ) ?? 0;

    const transactionsToday = salesToday?.length ?? 0;

    const { data: sessions } = await supabase
      .from("cash_sessions")
      .select("id")
      .is("closed_at", null)
      .limit(1);

    const cashStatus: "open" | "closed" =
      sessions && sessions.length > 0 ? "open" : "closed";

    const { data: inventory } = await supabase
      .from("inventory")
      .select("stock, min_stock");

    const lowStockCount =
      inventory?.filter((i) => i.stock > 0 && i.stock <= i.min_stock).length ??
      0;

    setKpi({
      salesToday: salesTodayTotal,
      transactionsToday,
      cashStatus,
      lowStockCount,
    });

    setLoading(false);
  }

  if (loading) {
    return <div className="p-6">Cargando dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          title="Ventas hoy"
          value={`$${kpi.salesToday.toFixed(2)}`}
          subtitle="Total del día"
        />

        <Card
          title="Transacciones"
          value={kpi.transactionsToday}
          subtitle="Ventas realizadas hoy"
        />

        <Card
          title="Estado de caja"
          value={kpi.cashStatus === "open" ? "Abierta" : "Cerrada"}
          subtitle={kpi.cashStatus === "open" ? "Operando" : "Sin caja activa"}
        />

        <Card
          title="Stock bajo"
          value={kpi.lowStockCount}
          subtitle="Productos en riesgo"
        />
      </div>
    </div>
  );
}