import { useState } from "react";
import { loginPos } from "@/lib/posAuth";

export default function Login() {
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🔐 Autenticación
      const user = await loginPos(nombre, password);

      if (!user) {
        throw new Error("Credenciales inválidas");
      }

      // 🧹 LIMPIEZA TOTAL antes de setear sesión
      localStorage.removeItem("pos_user");

      // 💾 Sesión definitiva
      localStorage.setItem("pos_user", JSON.stringify(user));

      // 🚨 REDIRECCIÓN DURA (NO navigate)
      window.location.replace("/pos");
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
      setLoading(false);
    }
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
