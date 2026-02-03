import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./AppShell";

import RoleGuard from "./components/RoleGuard";

import CajeroPOS from "./pages/CajeroPOS";
import Inventory from "./pages/Inventory";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import CashRegisterClosures from "./pages/CashRegisterClosures";
import SaleDetail from "./pages/SaleDetail";

import CerrarCaja from "./pages/CerrarCaja";
import CierreAdmin from "./pages/CierreAdmin";

export default function Router() {
  return (
    <Routes>

      <Route path="/app" element={<AppShell />}>

        {/* ===== ACCESOS CAJERO ===== */}
        <Route
          path="pos"
          element={
            <RoleGuard allowed={["admin", "gerente", "cajero"]}>
              <CajeroPOS />
            </RoleGuard>
          }
        />

        <Route
          path="cash-register"
          element={
            <RoleGuard allowed={["admin", "gerente", "cajero"]}>
              <CashRegisterClosures />
            </RoleGuard>
          }
        />

        <Route
          path="cerrar-caja"
          element={
            <RoleGuard allowed={["admin", "gerente", "cajero"]}>
              <CerrarCaja />
            </RoleGuard>
          }
        />

        <Route
          path="inventory"
          element={
            <RoleGuard allowed={["admin", "gerente", "cajero"]}>
              <Inventory />
            </RoleGuard>
          }
        />

        {/* ===== ACCESOS GERENTE ===== */}
        <Route
          path="products"
          element={
            <RoleGuard allowed={["admin", "gerente"]}>
              <Products />
            </RoleGuard>
          }
        />

        {/* ===== SOLO ADMIN ===== */}
        <Route
          path="sales"
          element={
            <RoleGuard allowed={["admin"]}>
              <Sales />
            </RoleGuard>
          }
        />

        <Route
          path="sale/:id"
          element={
            <RoleGuard allowed={["admin"]}>
              <SaleDetail />
            </RoleGuard>
          }
        />

        <Route
          path="reports"
          element={
            <RoleGuard allowed={["admin"]}>
              <Reports />
            </RoleGuard>
          }
        />

        {/* 🆕 NUEVA VISTA ADMIN DE DIFERENCIAS */}
        <Route
          path="cierres-admin"
          element={
            <RoleGuard allowed={["admin"]}>
              <CierreAdmin />
            </RoleGuard>
          }
        />

        <Route
          path="settings"
          element={
            <RoleGuard allowed={["admin"]}>
              <Settings />
            </RoleGuard>
          }
        />

        <Route
          path="users"
          element={
            <RoleGuard allowed={["admin"]}>
              <Users />
            </RoleGuard>
          }
        />

      </Route>

      <Route path="*" element={<Navigate to="/app/pos" replace />} />

    </Routes>
  );
}
