import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AppShell() {
  const { user, logout } = useAuth();
  const rol = user?.rol;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r">
        <div className="p-4 font-bold text-lg">
          Punto Claro
        </div>

        <nav className="px-4 space-y-2">
          {/* POS – todos */}
          <NavLink
            to="/pos"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Punto de Venta
          </NavLink>

          <NavLink
            to="/cerrar-caja"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Cerrar Caja
          </NavLink>

          {/* Inventario – todos (requerimiento del cliente) */}
          <NavLink
            to="/inventory"
            className="block px-3 py-2 rounded hover:bg-gray-100"
          >
            Inventario
          </NavLink>

          {/* Gerente + Admin */}
          {(rol === "gerente" || rol === "admin") && (
            <>
              <NavLink
                to="/products"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Productos
              </NavLink>

              <NavLink
                to="/sales"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Ventas
              </NavLink>

              <NavLink
                to="/reports"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Reportes
              </NavLink>
            </>
          )}

          {/* Solo Admin */}
          {rol === "admin" && (
            <>
              <NavLink
                to="/users"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Usuarios
              </NavLink>

              <NavLink
                to="/configuracion"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Configuración
              </NavLink>

              <NavLink
                to="/cierre-admin"
                className="block px-3 py-2 rounded hover:bg-gray-100"
              >
                Cierre Admin
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center bg-white border-b px-6 py-3">
          <div>
            Bienvenido: <strong>{user?.nombre}</strong>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Rol: {rol}
            </span>

            <button
              onClick={logout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
