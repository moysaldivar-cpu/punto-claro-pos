import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "gerente" | "cajero";

type PosUser = {
  id: string;
  nombre: string;
  rol: UserRole;
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
  rol: UserRole;
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

  const [managerStoreIds, setManagerStoreIds] = useState<string[]>([]);
  const [loadingManagerStores, setLoadingManagerStores] = useState(false);
  const [managerStoresReady, setManagerStoresReady] = useState(true);

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
    setManagerStoreIds([]);
    setLoadingManagerStores(false);
    setManagerStoresReady(true);
  }

  async function startEdit(user: PosUser) {
    setEditingId(user.id);

    setForm({
      nombre: user.nombre ?? "",
      password: "",
      rol: user.rol ?? "cajero",
      store_id: user.store_id ?? "",
      activo: Boolean(user.activo),
    });

    if (user.rol !== "gerente") {
      setManagerStoreIds([]);
      setLoadingManagerStores(false);
      setManagerStoresReady(true);
      return;
    }

    setManagerStoreIds(
      user.store_id ? [user.store_id] : []
    );
    setManagerStoresReady(false);
    setLoadingManagerStores(true);

    try {
      const authReady = await prepareFunctionsAuth();

      if (!authReady) {
        return;
      }

      const {
        data: storesData,
        error: storesError,
      } = await supabase.functions.invoke(
        "manage-pos-user",
        {
          body: {
            action: "get_stores",
            target_pos_user_id: user.id,
          },
        }
      );

      if (storesError) {
        console.error(
          "Error cargando sucursales del gerente:",
          storesError
        );

        const message =
          await getFunctionErrorMessage(
            storesError,
            "No se pudieron cargar las sucursales del gerente."
          );

        alert(message);
        return;
      }

      if (
        !storesData?.ok ||
        !Array.isArray(storesData.store_ids)
      ) {
        console.error(
          "Respuesta inválida al cargar sucursales del gerente:",
          storesData
        );

        alert(
          "No se pudieron confirmar las sucursales actuales del gerente."
        );
        return;
      }

      const loadedStoreIds = storesData.store_ids
        .filter(
          (storeId: unknown): storeId is string =>
            typeof storeId === "string" &&
            Boolean(storeId)
        );

      const nextStoreIds = Array.from(
        new Set(
          [
            user.store_id,
            ...loadedStoreIds,
          ].filter(
            (storeId): storeId is string =>
              typeof storeId === "string" &&
              Boolean(storeId)
          )
        )
      );

      setManagerStoreIds(nextStoreIds);
      setManagerStoresReady(true);
    } finally {
      setLoadingManagerStores(false);
    }
  }

  function getStoreName(storeId: string | null) {
    if (!storeId) return "Sin sucursal";

    const store = stores.find((s) => s.id === storeId);
    return store?.name ?? "Sucursal no encontrada";
  }

  function handleRoleChange(nextRole: UserRole) {
    const previousRole = form.rol;

    setForm((prev) => ({
      ...prev,
      rol: nextRole,
    }));

    if (nextRole !== "gerente") {
      setManagerStoreIds([]);
      setLoadingManagerStores(false);
      setManagerStoresReady(true);
      return;
    }

    if (previousRole !== "gerente") {
      setManagerStoreIds(
        form.store_id ? [form.store_id] : []
      );
      setLoadingManagerStores(false);
      setManagerStoresReady(true);
      return;
    }

    if (form.store_id) {
      setManagerStoreIds((prev) =>
        prev.includes(form.store_id)
          ? prev
          : [...prev, form.store_id]
      );
    }
  }

  function handlePrimaryStoreChange(storeId: string) {
    setForm((prev) => ({
      ...prev,
      store_id: storeId,
    }));

    if (form.rol === "gerente" && storeId) {
      setManagerStoreIds((prev) =>
        prev.includes(storeId)
          ? prev
          : [...prev, storeId]
      );
    }
  }

  function toggleManagerStore(storeId: string) {
    if (storeId === form.store_id) {
      return;
    }

    setManagerStoreIds((prev) => {
      if (prev.includes(storeId)) {
        return prev.filter((id) => id !== storeId);
      }

      return [...prev, storeId];
    });
  }

  async function prepareFunctionsAuth() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error(
        "No hay una sesión válida de administrador:",
        sessionError
      );

      alert(
        "Tu sesión de administrador no es válida. Cierra sesión y vuelve a entrar."
      );

      return false;
    }

    supabase.functions.setAuth(session.access_token);

    return true;
  }

  async function getFunctionErrorMessage(
    functionError: any,
    fallback: string
  ) {
    try {
      const context = functionError?.context;

      if (context && typeof context.json === "function") {
        const payload = await context.json();

        if (
          payload &&
          typeof payload.error === "string" &&
          payload.error.trim()
        ) {
          return payload.error;
        }
      }
    } catch (parseError) {
      console.error(
        "No se pudo leer el detalle del error de Edge Function:",
        parseError
      );
    }

    if (
      functionError &&
      typeof functionError.message === "string" &&
      functionError.message.trim()
    ) {
      return functionError.message;
    }

    return fallback;
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();

    const cleanName = form.nombre.trim();
    const cleanPassword = form.password.trim();

    if (!cleanName) {
      alert("Escribe el nombre del usuario.");
      return;
    }

    if (!editingId && !/^\d{8}$/.test(cleanPassword)) {
      alert("El PIN debe contener exactamente 8 dígitos.");
      return;
    }

    if (
      editingId &&
      cleanPassword &&
      !/^\d{8}$/.test(cleanPassword)
    ) {
      alert("El nuevo PIN debe contener exactamente 8 dígitos.");
      return;
    }

    if (!form.store_id) {
      alert("Selecciona una sucursal principal.");
      return;
    }

    if (
      editingId &&
      form.rol === "gerente" &&
      (
        loadingManagerStores ||
        !managerStoresReady
      )
    ) {
      alert(
        "Todavía no se han cargado correctamente las sucursales actuales del gerente. Cancela la edición y vuelve a intentarlo."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const authReady = await prepareFunctionsAuth();

        if (!authReady) {
          return;
        }

        const selectedManagerStores =
          form.rol === "gerente"
            ? Array.from(
                new Set(
                  [
                    form.store_id,
                    ...managerStoreIds,
                  ].filter(Boolean)
                )
              )
            : [];

        const {
          data: updateData,
          error: updateError,
        } = await supabase.functions.invoke(
          "manage-pos-user",
          {
            body: {
              action: "update",
              target_pos_user_id: editingId,
              nombre: cleanName,
              pin: cleanPassword,
              rol: form.rol,
              store_id: form.store_id,
              store_ids: selectedManagerStores,
              activo: form.activo,
            },
          }
        );

        if (updateError) {
          console.error(
            "Error actualizando usuario:",
            updateError
          );

          const message =
            await getFunctionErrorMessage(
              updateError,
              "No se pudo actualizar el usuario."
            );

          alert(
            "No se pudo actualizar el usuario: " +
              message
          );

          return;
        }

        if (!updateData?.ok) {
          console.error(
            "La función de actualización respondió sin confirmar éxito:",
            updateData
          );

          alert(
            "No se pudo confirmar la actualización del usuario."
          );

          return;
        }

        alert(
          cleanPassword
            ? "Usuario, sucursales y PIN actualizados correctamente."
            : form.rol === "gerente"
            ? "Usuario y sucursales actualizados correctamente."
            : "Usuario actualizado correctamente."
        );
      }else {
        const authReady = await prepareFunctionsAuth();

        if (!authReady) {
          return;
        }

        const selectedManagerStores =
          form.rol === "gerente"
            ? Array.from(
                new Set(
                  [
                    form.store_id,
                    ...managerStoreIds,
                  ].filter(Boolean)
                )
              )
            : [];

        const {
          data: createData,
          error: createError,
        } = await supabase.functions.invoke(
          "create-pos-user",
          {
            body: {
              nombre: cleanName,
              pin: cleanPassword,
              rol: form.rol,
              store_id: form.store_id,
              store_ids: selectedManagerStores,
              activo: form.activo,
            },
          }
        );

        if (createError) {
          console.error(
            "Error creando usuario:",
            createError
          );

          const message =
            await getFunctionErrorMessage(
              createError,
              "No se pudo crear el usuario."
            );

          alert(
            "No se pudo crear el usuario: " +
              message
          );

          return;
        }

        if (!createData?.ok) {
          console.error(
            "La función de creación respondió sin confirmar éxito:",
            createData
          );

          alert(
            "No se pudo confirmar la creación del usuario."
          );

          return;
        }

        alert("Usuario creado correctamente.");
      }

      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(user: PosUser) {
    const action = user.activo
      ? "desactivar"
      : "activar";

    const confirmed = window.confirm(
      `¿Seguro que deseas ${action} al usuario "${user.nombre}"?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("pos_users")
      .update({
        activo: !user.activo,
      })
      .eq("id", user.id);

    if (error) {
      console.error(
        "Error cambiando estado del usuario:",
        error
      );

      alert(
        "No se pudo cambiar el estado del usuario: " +
          error.message
      );

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
        <h1 className="text-2xl font-bold mb-2">
          Usuarios
        </h1>

        <p className="text-gray-600">
          Administra usuarios, roles y sucursales.
          Los cajeros operan únicamente en su
          sucursal asignada. Los gerentes pueden
          tener acceso a varias sucursales.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">
          {editingId
            ? "Editar usuario"
            : "Nuevo usuario"}
        </h2>

        <form
          onSubmit={saveUser}
          className="grid grid-cols-1 md:grid-cols-5 gap-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre
            </label>

            <input
              type="text"
              value={form.nombre}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nombre: e.target.value,
                }))
              }
              placeholder="Ej. Lupita"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {editingId
                ? "Nuevo PIN"
                : "PIN"}
            </label>

            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder={
                editingId
                  ? "8 dígitos; vacío = conservar"
                  : "8 dígitos"
              }
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              className="w-full border rounded px-3 py-2"
            />

            <p className="text-xs text-gray-500 mt-1">
              {editingId
                ? "Déjalo vacío si no deseas cambiar el PIN actual."
                : "El PIN debe tener exactamente 8 dígitos."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Rol
            </label>

            <select
              value={form.rol}
              onChange={(e) =>
                handleRoleChange(
                  e.target.value as UserRole
                )
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="cajero">
                Cajero
              </option>

              <option value="gerente">
                Gerente
              </option>

              <option value="admin">
                Admin
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Sucursal principal
            </label>

            <select
              value={form.store_id}
              onChange={(e) =>
                handlePrimaryStoreChange(
                  e.target.value
                )
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="">
                Selecciona sucursal
              </option>

              {stores.map((store) => (
                <option
                  key={store.id}
                  value={store.id}
                >
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Estado
            </label>

            <select
              value={
                form.activo
                  ? "active"
                  : "inactive"
              }
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  activo:
                    e.target.value ===
                    "active",
                }))
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="active">
                Activo
              </option>

              <option value="inactive">
                Inactivo
              </option>
            </select>
          </div>

          {form.rol === "gerente" && (
            <div className="md:col-span-5 border rounded p-4 bg-gray-50">
              <div className="mb-3">
                <h3 className="font-medium">
                  Sucursales del gerente
                </h3>

                <p className="text-xs text-gray-500 mt-1">
                  {editingId && loadingManagerStores
                    ? "Cargando sucursales actuales del gerente..."
                    : "Selecciona todas las sucursales a las que tendrá acceso. La sucursal principal siempre queda incluida."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stores.map((store) => {
                  const isPrimary =
                    store.id ===
                    form.store_id;

                  const checked =
                    isPrimary ||
                    managerStoreIds.includes(
                      store.id
                    );

                  const assignmentsLocked =
                    Boolean(editingId) &&
                    (
                      loadingManagerStores ||
                      !managerStoresReady
                    );

                  return (
                    <label
                      key={store.id}
                      className="flex items-center gap-2 border rounded px-3 py-2 bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          isPrimary ||
                          assignmentsLocked
                        }
                        onChange={() =>
                          toggleManagerStore(
                            store.id
                          )
                        }
                      />

                      <span className="text-sm">
                        {store.name}

                        {isPrimary
                          ? " (principal)"
                          : ""}
                      </span>
                    </label>
                  );
                })}
              </div>

              {editingId &&
                !loadingManagerStores &&
                !managerStoresReady && (
                  <p className="text-sm text-red-700 mt-3">
                    No se pudieron cargar de forma segura las sucursales actuales. Cancela la edición y vuelve a intentarlo antes de guardar cambios.
                  </p>
                )}
            </div>
          )}

          <div className="md:col-span-5 flex gap-3">
            <button
              type="submit"
              disabled={
                saving ||
                (
                  Boolean(editingId) &&
                  form.rol === "gerente" &&
                  (
                    loadingManagerStores ||
                    !managerStoresReady
                  )
                )
              }
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
                disabled={saving}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 disabled:opacity-60"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">
          Usuarios registrados
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="border px-3 py-2">
                  Nombre
                </th>

                <th className="border px-3 py-2">
                  Rol
                </th>

                <th className="border px-3 py-2">
                  Sucursal principal
                </th>

                <th className="border px-3 py-2">
                  Activo
                </th>

                <th className="border px-3 py-2">
                  Creado
                </th>

                <th className="border px-3 py-2">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50"
                >
                  <td className="border px-3 py-2 font-medium">
                    {user.nombre}
                  </td>

                  <td className="border px-3 py-2 capitalize">
                    {user.rol}
                  </td>

                  <td className="border px-3 py-2">
                    {getStoreName(
                      user.store_id
                    )}
                  </td>

                  <td className="border px-3 py-2">
                    {user.activo ? (
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
                    {user.created_at
                      ? new Date(
                          user.created_at
                        ).toLocaleString(
                          "es-MX"
                        )
                      : "-"}
                  </td>

                  <td className="border px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(user)
                        }
                        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleUserActive(
                            user
                          )
                        }
                        className={`px-3 py-1 rounded text-white ${
                          user.activo
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                      >
                        {user.activo
                          ? "Desactivar"
                          : "Activar"}
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
                    No hay usuarios
                    registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Los cajeros utilizan una sucursal principal. Los gerentes pueden recibir y administrar acceso a varias sucursales.
        </p>
      </div>
    </div>
  );
}