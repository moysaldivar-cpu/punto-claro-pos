import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function Section({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-2 px-2 text-xs uppercase tracking-wide text-gray-400">
      {title}
    </div>
  );
}

function Item({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded ${
          isActive
            ? "bg-gray-200 font-medium"
            : "hover:bg-gray-100"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppShell() {
  const { user, signOut, role, loadingRole } = useAuth();

  if (!user || loadingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <span className="text-gray-500">Cargando sesión…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">
            Punto Claro
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {user.email}
          </p>
          <p className="text-xs text-gray-400 capitalize">
            Rol: {role}
          </p>
        </div>

        <nav className="flex-1 p-3 text-sm overflow-y-auto">
          {/* ADMIN */}
          {role === "admin" && (
            <>
              <Section title="Operación" />
              <Item to="/app/admin">Dashboard</Item>
              <Item to="/app/pos">Punto de venta</Item>
              <Item to="/app/inventory">Inventario</Item>
              <Item to="/app/products">Productos</Item>

              <Section title="Control" />
              <Item to="/app/sales">Ventas</Item>
              <Item to="/app/cash-register-closures">
                Corte de caja
              </Item>
              <Item to="/app/reports">Reportes</Item>

              <Section title="Administración" />
              <Item to="/app/users">Usuarios</Item>
              <Item to="/app/settings">Configuración</Item>
            </>
          )}

          {/* GERENTE */}
          {role === "gerente" && (
            <>
              <Section title="Operación" />
              <Item to="/app/gerente">Dashboard</Item>
              <Item to="/app/inventory">Inventario</Item>
            </>
          )}

          {/* CAJERO */}
          {role === "cajero" && (
            <>
              <Section title="Operación" />
              <Item to="/app/pos">Punto de venta</Item>
            </>
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

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b flex items-center px-6">
          <h2 className="text-sm font-medium text-gray-700 capitalize">
            {role}
          </h2>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
