import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type Store = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  auto_print_ticket: boolean;
};

export default function Stores() {
  const { user } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [autoPrintTicket, setAutoPrintTicket] = useState(false);

  const isAdmin = user?.rol === "admin";

  async function loadStores() {
    setLoading(true);

    const { data, error } = await supabase
      .from("pos_stores")
      .select("id, name, is_active, created_at, auto_print_ticket")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando sucursales:", error);
      alert("No se pudieron cargar las sucursales.");
      setLoading(false);
      return;
    }

    setStores((data || []) as Store[]);
    setLoading(false);
  }

  useEffect(() => {
    loadStores();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setIsActive(true);
    setAutoPrintTicket(false);
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setName(store.name);
    setIsActive(store.is_active);
    setAutoPrintTicket(store.auto_print_ticket);
  }

  async function saveStore(e: React.FormEvent) {
    e.preventDefault();

    if (!isAdmin) {
      alert("Solo el administrador puede administrar sucursales.");
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      alert("Escribe el nombre de la sucursal.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("pos_stores")
        .update({
          name: cleanName,
          is_active: isActive,
          auto_print_ticket: autoPrintTicket,
        })
        .eq("id", editingId);

      if (error) {
        console.error("Error actualizando sucursal:", error);
        alert("No se pudo actualizar la sucursal.");
        setSaving(false);
        return;
      }

      alert("Sucursal actualizada correctamente.");
    } else {
      const { error } = await supabase.from("pos_stores").insert({
        name: cleanName,
        is_active: isActive,
        auto_print_ticket: autoPrintTicket,
      });

      if (error) {
        console.error("Error creando sucursal:", error);
        alert("No se pudo crear la sucursal.");
        setSaving(false);
        return;
      }

      alert("Sucursal creada correctamente.");
    }

    resetForm();
    await loadStores();
    setSaving(false);
  }

  async function toggleStoreActive(store: Store) {
    if (!isAdmin) {
      alert("Solo el administrador puede administrar sucursales.");
      return;
    }

    const action = store.is_active ? "desactivar" : "activar";

    const confirmed = window.confirm(
      `¿Seguro que deseas ${action} la sucursal "${store.name}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("pos_stores")
      .update({ is_active: !store.is_active })
      .eq("id", store.id);

    if (error) {
      console.error("Error cambiando estado de sucursal:", error);
      alert("No se pudo cambiar el estado de la sucursal.");
      return;
    }

    await loadStores();
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-xl font-bold mb-2">Sucursales</h1>
        <p className="text-gray-600">
          No tienes permiso para administrar sucursales.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Sucursales</h1>
        <p className="text-gray-600">
          Administra las sucursales del sistema. Puedes crear nuevas sucursales,
          editar su nombre y activar o desactivar su operación.
        </p>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? "Editar sucursal" : "Nueva sucursal"}
        </h2>

        <form onSubmit={saveStore} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Nombre de la sucursal
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sucursal Centro"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Ticket automático
            </label>
            <select
              value={autoPrintTicket ? "yes" : "no"}
              onChange={(e) => setAutoPrintTicket(e.target.value === "yes")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="no">No</option>
              <option value="yes">Sí</option>
            </select>
          </div>

          <div className="md:col-span-4 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {saving
                ? "Guardando..."
                : editingId
                ? "Guardar cambios"
                : "Crear sucursal"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Sucursales registradas</h2>

        {loading ? (
          <p className="text-gray-600">Cargando sucursales...</p>
        ) : stores.length === 0 ? (
          <p className="text-gray-600">Todavía no hay sucursales registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Sucursal</th>
                  <th className="border px-3 py-2 text-left">Estado</th>
                  <th className="border px-3 py-2 text-left">
                    Ticket automático
                  </th>
                  <th className="border px-3 py-2 text-left">Creada</th>
                  <th className="border px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="border px-3 py-2 font-medium">
                      {store.name}
                    </td>

                    <td className="border px-3 py-2">
                      {store.is_active ? (
                        <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                          Activa
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
                          Inactiva
                        </span>
                      )}
                    </td>

                    <td className="border px-3 py-2">
                      {store.auto_print_ticket ? "Sí" : "No"}
                    </td>

                    <td className="border px-3 py-2 text-gray-600">
                      {store.created_at
                        ? new Date(store.created_at).toLocaleString("es-MX")
                        : "-"}
                    </td>

                    <td className="border px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(store)}
                          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleStoreActive(store)}
                          className={`px-3 py-1 rounded text-white ${
                            store.is_active
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {store.is_active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-gray-500 mt-3">
              Nota: las sucursales no se eliminan para proteger historial de
              ventas, inventario, cortes y usuarios relacionados. Si una sucursal
              ya no se usa, se desactiva.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}