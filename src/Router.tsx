import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/AppShell";

import Login from "@/pages/Login";
import CajeroPOS from "@/pages/CajeroPOS";
import Inventory from "@/pages/Inventory";
import Products from "@/pages/Products";
import Sales from "@/pages/Sales";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import AdminDashboard from "@/pages/AdminDashboard";
import CloseCashSession from "@/pages/CloseCashSession";
import ConteoTurno from "@/pages/ConteoTurno";
import InventoryLoss from "@/pages/InventoryLoss";

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

        {/* Inventario */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Registrar merma */}
        <Route
          path="/inventory-loss"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <InventoryLoss />
            </ProtectedRoute>
          }
        />

        {/* Productos */}
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <Products />
            </ProtectedRoute>
          }
        />

        {/* Ventas */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute allowedRoles={["gerente", "admin"]}>
              <Sales />
            </ProtectedRoute>
          }
        />

        {/* Reportes - SOLO ADMIN */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Usuarios */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Configuración */}
        <Route
          path="/configuracion"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Configuracion />
            </ProtectedRoute>
          }
        />

        {/* Cierre administrativo */}
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