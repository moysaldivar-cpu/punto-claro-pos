import { useState } from "react";
import {
  getCurrentPosUserStores,
  loginPosWithAuth,
  savePosUserSession,
  setActiveStoreForSession,
  type PosUser,
  type PosUserStore,
} from "@/lib/posAuth";

export default function Login() {
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingUser, setPendingUser] = useState<PosUser | null>(null);
  const [pendingUsers, setPendingUsers] = useState<PosUser[]>([]);
  const [availableStores, setAvailableStores] = useState<PosUserStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  async function finishLogin(user: PosUser) {
    savePosUserSession(user);
    window.location.replace("/pos");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const users = await loginPosWithAuth(nombre, password);

      // Caso PROVISIONAL:
      // una identidad Auth vinculada a varias filas POS, una por sucursal.
      if (users.length > 1) {
        const stores = users
          .filter((user) => user.store_id)
          .map(
            (user): PosUserStore => ({
              store_id: user.store_id as string,
              store_name: user.store_name || "Sucursal",
              is_active: true,
              auto_print_ticket: false,
            })
          );

        if (stores.length === 0) {
          throw new Error("Este usuario no tiene sucursales asignadas.");
        }

        setPendingUser(users[0]);
        setPendingUsers(users);
        setAvailableStores(stores);
        setSelectedStoreId(stores[0].store_id);
        setLoading(false);
        return;
      }

      const user = users[0];

      // Cajero/admin con una sola fila POS.
      if (user.rol !== "gerente") {
        await finishLogin(user);
        return;
      }

      // Gerente: conserva su mismo pos_users.id y elige sucursal asignada.
      const stores = await getCurrentPosUserStores();

      if (stores.length === 0) {
        throw new Error("Este usuario no tiene sucursales asignadas.");
      }

      if (stores.length === 1) {
        const updatedUser = setActiveStoreForSession(
          user,
          stores[0].store_id
        );
        await finishLogin(updatedUser);
        return;
      }

      setPendingUser(user);
      setPendingUsers([user]);
      setAvailableStores(stores);
      setSelectedStoreId(stores[0].store_id);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesion");
      setLoading(false);
    }
  }

  async function handleStoreSelection(e: React.FormEvent) {
    e.preventDefault();

    if (!pendingUser) {
      setError("No hay usuario pendiente para seleccionar sucursal.");
      return;
    }

    if (!selectedStoreId) {
      setError("Debes seleccionar una sucursal.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // PROVISIONAL: elegir la fila POS exacta de la sucursal.
      if (pendingUsers.length > 1) {
        const selectedUser = pendingUsers.find(
          (user) => user.store_id === selectedStoreId
        );

        if (!selectedUser) {
          throw new Error(
            "No se encontro el usuario POS correspondiente a la sucursal."
          );
        }

        await finishLogin(selectedUser);
        return;
      }

      // Gerente: mismo usuario POS, cambia solamente la sucursal activa.
      const updatedUser = setActiveStoreForSession(
        pendingUser,
        selectedStoreId
      );

      await finishLogin(updatedUser);
    } catch (err: any) {
      setError(err.message || "Error al seleccionar sucursal");
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setPendingUser(null);
    setPendingUsers([]);
    setAvailableStores([]);
    setSelectedStoreId("");
    setPassword("");
    setError("");
    setLoading(false);
    localStorage.removeItem("pos_user");
    localStorage.removeItem("store_id");
  }

  if (pendingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form
          onSubmit={handleStoreSelection}
          className="bg-white p-6 rounded shadow w-96"
        >
          <h1 className="text-xl font-bold mb-2">Seleccionar sucursal</h1>

          <p className="text-sm text-gray-600 mb-4">
            Bienvenido,{" "}
            <span className="font-semibold">{pendingUser.nombre}</span>.
            Selecciona la sucursal con la que vas a trabajar.
          </p>

          {error && (
            <div className="mb-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full mb-4 px-3 py-2 border rounded"
            required
          >
            {availableStores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.store_name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-3"
          >
            {loading ? "Entrando..." : "Continuar"}
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="w-full border py-2 rounded hover:bg-gray-50"
          >
            Volver
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow w-80"
      >
        <h1 className="text-xl font-bold mb-4">Iniciar sesion</h1>

        {error && (
          <div className="mb-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Usuario"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full mb-3 px-3 py-2 border rounded"
          required
        />

        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 border rounded"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
