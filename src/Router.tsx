import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "../src/AppShell";

import RoleGuard from "../src/components/RoleGuard";

import CajeroPOS from "../src/pages/CajeroPOS";
import Inventory from "../src/pages/Inventory";
import Products from "../src/pages/Products";
import Sales from "../src/pages/Sales";
import Reports from "../src/pages/Reports";
import Settings from "../src/pages/Settings";
import Users from "../src/pages/Users";
import CashRegisterClosures from "../src/pages/CashRegisterClosures";
import SaleDetail from "../src/pages/SaleDetail";

import CerrarCaja from "../src/pages/CerrarCaja";
import CierreAdmin from "../src/pages/CierreAdmin";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/pos" />} />

        <Route path="/pos" element={<CajeroPOS />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/products" element={<Products />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/:id" element={<SaleDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />

        <Route
          path="/cash-register-closures"
          element={<CashRegisterClosures />}
        />

        <Route path="/cerrar-caja" element={<CerrarCaja />} />
        <Route path="/cierre-admin" element={<CierreAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
