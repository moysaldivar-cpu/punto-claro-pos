import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;
  activo: boolean;
  created_at: string | null;
};

type StoreOption = {
  id: string;
  name: string;
};

type FormState = {
  nombre: string;
  password: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string;
  activo: boolean;
};

const emptyForm: FormState = {
  nombre: "",
  password: "",
  rol: "cajero",
  store_id: "",
  activo: true,
};

export default function Users() {
  const [users, setUsers] = useState<PosUser[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    const [usersResult, storesResult] = await Promise.all([
      supabase
        .from("pos_users")
        .select("id, nombre, rol, store_id, activo, created_at")
        .order("nombre"),
      supabase
        .from("pos_stores")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (usersResult.error) {
      console.error("Error cargando usuarios:", usersResult.error);
      setError("No se pudieron cargar los usuarios.");
      setUsers([]);
    } else {
      setUsers((usersResult.data ?? []) as PosUser[]);
    }

    if (storesResult.error) {
      console.error("Error cargando sucursales:", storesResult.error);
      setStores([]);
    } else {
      setStores((storesResult.data ?? []) as StoreOption[]);
    }

    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(user: PosUser) {
    setEditingId(user.id);
    setForm({
      nombre: user.nombre ?? "",
      password: "",
      rol: user.rol ?? "cajero",
      store_id: user.store_id ?? "",
      activo: Boolean(user.activo),
    });
  }

  function getStoreName(storeId: string | null) {
    if (!storeId) return "Sin sucursal fija";

    const store = stores.find((s) => s.id === storeId);
    return store?.name ?? "Sucursal no encontrada";
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = form.nombre.trim();
    const cleanPassword = form.password.trim();

    if (!cleanName) {
      alert("Escribe el nombre del usuario.");
      return;
    }

    if (!editingId && !cleanPassword) {
      alert("Escribe el PIN o contraseña del usuario.");
      return;
    }

    if (editingId && cleanPassword && !/^\d{8}$/.test(cleanPassword)) {
      alert("El nuevo PIN debe contener exactamente 8 dígitos.");
      return;
    }

    if ((form.rol === "cajero" || form.rol === "gerente") && !form.store_id) {
      alert("Selecciona una sucursal para el cajero o gerente.");
      return;
    }

    setSaving(true);

    const userPayload = {
      nombre: cleanName,
      rol: form.rol,
      store_id: form.rol === "admin" && !form.store_id ? null : form.store_id,
      activo: form.activo,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("pos_users")
        .update(userPayload)
        .eq("id", editingId);

      if (updateError) {
        console.error("Error actualizando usuario:", updateError);
        alert("No se pudo actualizar el usuario: " + updateError.message);
        setSaving(false);
        return;
      }

      if (cleanPassword) {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          console.error("No hay una sesión válida para cambiar el PIN:", sessionError);
          alert("Tu sesión de administrador no es válida. Cierra sesión y vuelve a entrar.");
          setSaving(false);
          return;
        }

        supabase.functions.setAuth(session.access_token);

        const { error: pinError } = await supabase.functions.invoke(
          "reset-pos-pin",
          {
            body: {
              target_pos_user_id: editingId,
              pin: cleanPassword,
            },
          }
        );

        if (pinError) {
          console.error("Error actualizando PIN:", pinError);
          alert(
            "Los datos del usuario se actualizaron, pero no se pudo cambiar el PIN: " +
              pinError.message
          );
          await loadData();
          setSaving(false);
          return;
        }
      }

      alert(
        cleanPassword
          ? "Usuario y PIN actualizados correctamente."
          : "Usuario actualizado correctamente."
      );
    } else {
      // Alta legacy: se conserva sin cambios por ahora.
      // La creación/vinculación de cuentas nuevas de Supabase Auth se hará aparte.
      const { error: insertError } = await supabase.from("pos_users").insert({
        ...userPayload,
        password: cleanPassword,
      });

      if (insertError) {
        console.error("Error creando usuario:", insertError);
        alert("No se pudo crear el usuario: " + insertError.message);
        setSaving(false);
        return;
      }

      alert("Usuario creado correctamente.");
    }

    resetForm();
    await loadData();
    setSaving(false);
  }

  async function toggleUserActive(user: PosUser) {
    const action = user.activo ? "desactivar" : "activar";

    const confirmed = window.confirm(
      `¿Seguro que deseas ${action} al usuario "${user.nombre}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("pos_users")
      .update({ activo: !user.activo })
      .eq("id", user.id);

    if (error) {
      console.error("Error cambiando estado del usuario:", error);
      alert("No se pudo cambiar el estado del usuario: " + error.message);
      return;
    }

    await loadData();
  }

  if (loading) {
    return <div>Cargando usuarios…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-2">Usuarios</h1>
        <p className="text-gray-600">
          Administra usuarios, roles y sucursal asignada. Los cajeros operan
          únicamente en la sucursal que tengan asignada.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">
          {editingId ? "Editar usuario" : "Nuevo usuario"}
        </h2>

        <form onSubmit={saveUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Ej. Lupita"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {editingId ? "Nuevo PIN" : "PIN / Contraseña"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder={
                editingId
                  ? "8 dígitos; vacío = conservar"
                  : "PIN del usuario"
              }
              inputMode="numeric"
              autoComplete="new-password"
              className="w-full border rounded px-3 py-2"
            />
            {editingId && (
              <p className="text-xs text-gray-500 mt-1">
                Déjalo vacío si no deseas cambiar el PIN actual.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rol</label>
            <select
              value={form.rol}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  rol: e.target.value as "admin" | "gerente" | "cajero",
                  store_id:
                    e.target.value === "admin" ? prev.store_id : prev.store_id,
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="cajero">Cajero</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Sucursal asignada
            </label>
            <select
              value={form.store_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, store_id: e.target.value }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="">
                {form.rol === "admin"
                  ? "Sin sucursal fija"
                  : "Selecciona sucursal"}
              </option>

              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Estado</label>
            <select
              value={form.activo ? "active" : "inactive"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  activo: e.target.value === "active",
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          <div className="md:col-span-5 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {saving
                ? "Guardando..."
                : editingId
                ? "Guardar cambios"
                : "Crear usuario"}
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
        <h2 className="text-lg font-semibold mb-4">Usuarios registrados</h2>

        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="border px-3 py-2">Nombre</th>
                <th className="border px-3 py-2">Rol</th>
                <th className="border px-3 py-2">Sucursal asignada</th>
                <th className="border px-3 py-2">Activo</th>
                <th className="border px-3 py-2">Creado</th>
                <th className="border px-3 py-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 font-medium">{u.nombre}</td>

                  <td className="border px-3 py-2 capitalize">{u.rol}</td>

                  <td className="border px-3 py-2">
                    {getStoreName(u.store_id)}
                  </td>

                  <td className="border px-3 py-2">
                    {u.activo ? (
                      <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                        Sí
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
                        No
                      </span>
                    )}
                  </td>

                  <td className="border px-3 py-2 text-gray-600">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleString("es-MX")
                      : "-"}
                  </td>

                  <td className="border px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleUserActive(u)}
                        className={`px-3 py-1 rounded text-white ${
                          u.activo
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="border px-3 py-4 text-center text-gray-500"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Nota: para evitar errores de operación, los cajeros deben tener una
          sucursal asignada. El administrador puede consultar varias sucursales
          desde su acceso.
        </p>
      </div>
    </div>
  );
}
