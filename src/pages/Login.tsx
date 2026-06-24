import { useState } from "react";
import {
  getPosUserStores,
  loginPos,
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
  const [availableStores, setAvailableStores] = useState<PosUserStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  async function finishLogin(user: PosUser) {
    localStorage.removeItem("pos_user");
    localStorage.setItem("pos_user", JSON.stringify(user));

    if (user.store_id) {
      localStorage.setItem("store_id", user.store_id);
    } else {
      localStorage.removeItem("store_id");
    }

    window.location.replace("/pos");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await loginPos(nombre, password);

      if (!user) {
        throw new Error("Credenciales inválidas");
      }

      if (user.rol !== "gerente") {
        await finishLogin(user);
        return;
      }

      const stores = await getPosUserStores(user.id);

      if (stores.length === 0) {
        throw new Error("Este usuario no tiene sucursales asignadas.");
      }

      if (stores.length === 1) {
        const updatedUser = setActiveStoreForSession(user, stores[0].store_id);
        await finishLogin(updatedUser);
        return;
      }

      setPendingUser(user);
      setAvailableStores(stores);
      setSelectedStoreId(stores[0].store_id);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
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
      const updatedUser = setActiveStoreForSession(pendingUser, selectedStoreId);
      await finishLogin(updatedUser);
    } catch (err: any) {
      setError(err.message || "Error al seleccionar sucursal");
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setPendingUser(null);
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
            Bienvenido, <span className="font-semibold">{pendingUser.nombre}</span>.
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
            {loading ? "Entrando…" : "Continuar"}
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
        <h1 className="text-xl font-bold mb-4">Iniciar sesión</h1>

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
          placeholder="Contraseña"
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
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}