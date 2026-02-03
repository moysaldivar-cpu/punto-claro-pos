import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function Item({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded ${
          isActive ? "bg-gray-200 font-medium" : "hover:bg-gray-100"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function AppShell() {
  const { user, signOut, role } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <span className="text-gray-500">Cargando sesión…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">Punto Claro</h1>
          <p className="text-xs text-gray-500 mt-1">{user.email}</p>
          <p className="text-xs text-gray-400 capitalize">
            Rol: {role ?? "(sin rol)"}
          </p>
        </div>

        <nav className="flex-1 p-4 text-sm space-y-6">

          <div>
            <p className="text-xs text-gray-400 mb-2 uppercase">Operación</p>

            <Item to="/app/pos" label="Punto de venta" />
            <Item to="/app/cash-register" label="Corte de caja" />
            <Item to="/app/cerrar-caja" label="Cerrar caja" />
            <Item to="/app/inventory" label="Inventario" />

            {(role === "admin" || role === "gerente") && (
              <Item to="/app/products" label="Productos" />
            )}
          </div>

          {role === "admin" && (
            <div>
              <p className="text-xs text-gray-400 mb-2 uppercase">Control</p>

              <Item to="/app/sales" label="Ventas" />
              <Item to="/app/reports" label="Reportes" />

              {/* 🆕 */}
              <Item to="/app/cierres-admin" label="Cierres (Admin)" />
            </div>
          )}

          {role === "admin" && (
            <div>
              <p className="text-xs text-gray-400 mb-2 uppercase">
                Administración
              </p>

              <Item to="/app/users" label="Usuarios" />
              <Item to="/app/settings" label="Configuración" />
            </div>
          )}

        </nav>

        <div className="p-4 border-t">
          <button
            onClick={signOut}
            className="w-full text-sm text-red-600 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
