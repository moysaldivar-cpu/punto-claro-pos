import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/AppShell";

import Login from "@/pages/Login";
import CajeroPOS from "@/pages/CajeroPOS";
import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import Promotions from "@/pages/Promotions";
import Sales from "@/pages/Sales";
import SaleDetail from "@/pages/SaleDetail";
import SalesHistory from "@/pages/SalesHistory";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import AdminDashboard from "@/pages/AdminDashboard";
import CloseCashSession from "@/pages/CloseCashSession";
import ConteoTurno from "@/pages/ConteoTurno";
import InventoryLoss from "@/pages/InventoryLoss";
import Stores from "@/pages/Stores";
import SaleAdjustments from "@/pages/SaleAdjustments";

/* Configuración placeholder */
function Configuracion() {
  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-xl font-bold mb-2">Configuración</h1>
      <p className="text-gray-600">
        Este módulo estará disponible en próximas versiones del sistema.
      </p>
    </div>
  );
}

export default function Router() {
  return (
    <Routes>
      {/* Redirección raíz */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Ruta pública */}
      <Route path="/login" element={<Login />} />

      {/* Layout protegido */}
      <Route
        element={
          <ProtectedRoute allowedRoles={["cajero", "gerente", "admin"]}>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* POS */}
        <Route path="/pos" element={<CajeroPOS />} />

        {/* Conteo de turno */}
        <Route path="/conteo-turno" element={<ConteoTurno />} />

        {/* Cierre de caja */}
        <Route path="/cerrar-caja" element={<CloseCashSession />} />

        {/* Inventario - gerente y admin */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Registrar merma - gerente y admin */}
        <Route
          path="/inventory-loss"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <InventoryLoss />
            </ProtectedRoute>
          }
        />

        {/* Productos - gerente y admin */}
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <Products />
            </ProtectedRoute>
          }
        />

        {/* Promociones - solo admin */}
        <Route
          path="/promotions"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Promotions />
            </ProtectedRoute>
          }
        />

        {/* Sucursales - solo admin */}
        <Route
          path="/stores"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Stores />
            </ProtectedRoute>
          }
        />

        {/* Ventas - solo admin */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Sales />
            </ProtectedRoute>
          }
        />

        {/* Detalle de venta - solo admin */}
        <Route
          path="/sales/:id"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SaleDetail />
            </ProtectedRoute>
          }
        />

        {/* Historial de ventas / Reimpresión de ticket - solo admin */}
        <Route
          path="/sales-history"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SalesHistory />
            </ProtectedRoute>
          }
        />

        {/* Cancelaciones y devoluciones - solo admin */}
        <Route
          path="/sale-adjustments"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <SaleAdjustments />
            </ProtectedRoute>
          }
        />

        {/* Reportes - solo admin */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Usuarios - solo admin */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Configuración - solo admin */}
        <Route
          path="/configuracion"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Configuracion />
            </ProtectedRoute>
          }
        />

        {/* Cierre administrativo - solo admin */}
        <Route
          path="/cierre-admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}