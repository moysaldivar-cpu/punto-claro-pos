import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./AppShell";

import RoleGuard from "./components/RoleGuard";

// 🔹 PÁGINAS PRINCIPALES (usando alias @/)
import CajeroPOS from "@/pages/CajeroPOS";
import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import CashRegisterClosures from "@/pages/CashRegisterClosures";
import SaleDetail from "@/pages/SaleDetail";

import CerrarCaja from "@/pages/CerrarCaja";
import CierreAdmin from "@/pages/CierreAdmin";

export default function Router() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/pos" replace />} />

        <Route path="/pos" element={<CajeroPOS />} />

        <Route path="/inventory" element={<Inventory />} />

        <Route path="/products" element={<Products />} />

        <Route path="/sales" element={<Sales />} />

        <Route path="/sales/:id" element={<SaleDetail />} />

        <Route path="/reports" element={<Reports />} />

        <Route path="/settings" element={<Settings />} />

        <Route path="/users" element={<Users />} />

        <Route path="/closures" element={<CashRegisterClosures />} />

        <Route path="/cerrar-caja" element={<CerrarCaja />} />

        <Route path="/cierre-admin" element={<CierreAdmin />} />

        {/* Cualquier ruta desconocida */}
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Route>
    </Routes>
  );
}
