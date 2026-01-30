import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/AppShell";

import Login from "@/pages/Login";
import AdminDashboard from "@/pages/AdminDashboard";
import GerenteDashboard from "@/pages/GerenteDashboard";
import CajeroPOS from "@/pages/CajeroPOS";
import Inventory from "@/pages/Inventory";
import SalesHistory from "@/pages/SalesHistory";
import SaleDetail from "@/pages/SaleDetail";
import Reports from "@/pages/Reports";
import CashRegisterClosures from "@/pages/CashRegisterClosures";
import Settings from "@/pages/Settings";
import Products from "@/pages/Products";

export default function Router() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/login" element={<Login />} />

      {/* App protegida */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="pos" replace />} />

        {/* Admin */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Gerente */}
        <Route
          path="gerente"
          element={
            <ProtectedRoute allowedRoles={["admin", "gerente"]}>
              <GerenteDashboard />
            </ProtectedRoute>
          }
        />

        {/* POS */}
        <Route
          path="pos"
          element={
            <ProtectedRoute allowedRoles={["admin", "gerente", "cajero"]}>
              <CajeroPOS />
            </ProtectedRoute>
          }
        />

        {/* Inventario */}
        <Route
          path="inventory"
          element={
            <ProtectedRoute allowedRoles={["admin", "gerente", "cajero"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Productos (admin + gerente) */}
        <Route
          path="products"
          element={
            <ProtectedRoute allowedRoles={["admin", "gerente"]}>
              <Products />
            </ProtectedRoute>
          }
        />

        {/* Ventas */}
        <Route
          path="sales"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SalesHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="sales/:saleId"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SaleDetail />
            </ProtectedRoute>
          }
        />

        {/* Reportes */}
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Cortes de caja */}
        <Route
          path="cash-register-closures"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <CashRegisterClosures />
            </ProtectedRoute>
          }
        />

        {/* Configuración */}
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
