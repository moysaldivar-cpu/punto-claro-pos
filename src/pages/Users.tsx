import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserRow = {
  user_id: string;
  email: string | null;
  role: string | null;
  active: boolean;
};

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc(
        "get_users_with_roles"
      );

      if (error) {
        console.error("Error loading users:", error);
        setError("No se pudieron cargar los usuarios.");
        setUsers([]);
      } else {
        setUsers(data ?? []);
      }

      setLoading(false);
    };

    loadUsers();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      {loading && (
        <div className="text-gray-500 text-sm">Cargando usuarios…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Email</th>
                <th className="border px-3 py-2 text-left">Rol</th>
                <th className="border px-3 py-2 text-left">Activo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td className="border px-3 py-2">
                    {u.email ?? "—"}
                  </td>
                  <td className="border px-3 py-2 capitalize">
                    {u.role ?? "—"}
                  </td>
                  <td className="border px-3 py-2">
                    {u.active ? "Sí" : "No"}
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="border px-3 py-4 text-center text-gray-500"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
