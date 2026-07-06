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
    <div className="h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar fijo */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r overflow-y-auto">
        <div className="p-4 font-bold text-lg">Punto Claro</div>

        <nav className="px-4 pb-6 space-y-2">
          {/* POS – todos */}
          <NavLink to="/pos" className={linkClass}>
            Punto de Venta
          </NavLink>

          {/* Conteo de Turno – todos */}
          <NavLink to="/conteo-turno" className={linkClass}>
            Conteo de Turno
          </NavLink>

          {/* Cerrar Caja – todos */}
          <NavLink to="/cerrar-caja" className={linkClass}>
            Cerrar Caja
          </NavLink>

          {/* Registrar Merma – cajero, gerente y admin */}
          {(rol === "cajero" || rol === "gerente" || rol === "admin") && (
            <NavLink to="/inventory-loss" className={linkClass}>
              Registrar Merma
            </NavLink>
          )}

          {/* Inventario – solo gerente y admin */}
          {(rol === "gerente" || rol === "admin") && (
            <NavLink to="/inventory" className={linkClass}>
              Inventario
            </NavLink>
          )}

          {/* Productos – gerente y admin */}
          {(rol === "gerente" || rol === "admin") && (
            <NavLink to="/products" className={linkClass}>
              Productos
            </NavLink>
          )}

          {/* Solo Admin */}
          {rol === "admin" && (
            <>
              <NavLink to="/promotions" className={linkClass}>
                Promociones
              </NavLink>

              <NavLink to="/stores" className={linkClass}>
                Sucursales
              </NavLink>

              <NavLink to="/sales" className={linkClass}>
                Ventas
              </NavLink>

              <NavLink to="/sales-history" className={linkClass}>
                Historial de Ventas
              </NavLink>

              <NavLink to="/reports" className={linkClass}>
                Reportes
              </NavLink>

              <NavLink to="/users" className={linkClass}>
                Usuarios
              </NavLink>

              <NavLink to="/cierre-admin" className={linkClass}>
                Cierre Admin
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Área principal desplazada por el sidebar */}
      <div className="ml-64 h-screen flex flex-col">
        {/* Header fijo */}
        <header className="h-16 shrink-0 flex justify-between items-center bg-white border-b px-6">
          <div>
            Bienvenido: <strong>{user?.nombre}</strong>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Rol: {rol}</span>

            <button
              onClick={logout}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Content con scroll propio */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}