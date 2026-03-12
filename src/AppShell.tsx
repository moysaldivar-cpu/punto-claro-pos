import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AppShell() {
  const { user, logout } = useAuth();
  const rol = user?.rol;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded hover:bg-gray-100 ${
      isActive ? "bg-gray-200 font-semibold" : ""
    }`;

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r">
        <div className="p-4 font-bold text-lg">
          Punto Claro
        </div>

        <nav className="px-4 space-y-2">
          {/* POS – todos */}
          <NavLink to="/pos" className={linkClass}>
            Punto de Venta
          </NavLink>

          {/* Conteo de Turno – todos */}
          <NavLink to="/conteo-turno" className={linkClass}>
            Conteo de Turno
          </NavLink>

          <NavLink to="/cerrar-caja" className={linkClass}>
            Cerrar Caja
          </NavLink>

          {/* Inventario – gerente y admin */}
          {(rol === "gerente" || rol === "admin") && (
            <>
              <NavLink to="/inventory" className={linkClass}>
                Inventario
              </NavLink>

              <NavLink to="/inventory-loss" className={linkClass}>
                Registrar Merma
              </NavLink>
            </>
          )}

          {/* Gerente + Admin */}
          {(rol === "gerente" || rol === "admin") && (
            <>
              <NavLink to="/products" className={linkClass}>
                Productos
              </NavLink>

              <NavLink to="/sales" className={linkClass}>
                Ventas
              </NavLink>
            </>
          )}

          {/* Solo Admin */}
          {rol === "admin" && (
            <>
              <NavLink to="/reports" className={linkClass}>
                Reportes
              </NavLink>

              <NavLink to="/users" className={linkClass}>
                Usuarios
              </NavLink>

              <NavLink to="/configuracion" className={linkClass}>
                Configuración
              </NavLink>

              <NavLink to="/cierre-admin" className={linkClass}>
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