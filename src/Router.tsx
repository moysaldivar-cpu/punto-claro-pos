import { Routes, Route, Navigate } from "react-router-dom";

import AppShell from "@/AppShell";

import CajeroPOS from "@/pages/CajeroPOS";
import Products from "@/pages/Products";
import Inventory from "@/pages/Inventory";
import CashRegisterClosures from "@/pages/CashRegisterClosures";

import Sales from "@/pages/Sales";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

import AdminDashboard from "@/pages/AdminDashboard";
import GerenteDashboard from "@/pages/GerenteDashboard";
import Users from "@/pages/Users";

export default function Router() {
  return (
    <Routes>
      <Route path="/app" element={<AppShell />}>
        {/* POS */}
        <Route index element={<CajeroPOS />} />
        <Route path="pos" element={<CajeroPOS />} />

        {/* Operación */}
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="cash-register" element={<CashRegisterClosures />} />

        {/* Control */}
        <Route path="sales" element={<Sales />} />
        <Route path="reports" element={<Reports />} />

        {/* Administración */}
        <Route path="settings" element={<Settings />} />
        <Route path="users" element={<Users />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="gerente" element={<GerenteDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
