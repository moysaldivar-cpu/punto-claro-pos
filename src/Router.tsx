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
import CashRegisterClosures from "@/pages/CashRegisterClosures";
import AdminDashboard from "@/pages/AdminDashboard";

/* 🧩 Placeholder Configuración */
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
      {/* Pública */}
      <Route path="/login" element={<Login />} />

      {/* 🔐 RUTAS PROTEGIDAS CON LAYOUT */}
      <Route
        element={
          <ProtectedRoute allowedRoles={["cajero", "gerente", "admin"]}>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* POS */}
        <Route path="/pos" element={<CajeroPOS />} />
        <Route path="/cerrar-caja" element={<CashRegisterClosures />} />

        {/* Inventario (todos) */}
        <Route path="/inventory" element={<Inventory />} />

        {/* Gerente + Admin */}
        <Route path="/products" element={<Products />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/reports" element={<Reports />} />

        {/* Solo Admin */}
        <Route path="/users" element={<Users />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/cierre-admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}
