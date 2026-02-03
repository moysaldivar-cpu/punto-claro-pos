import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function CerrarCaja() {
  const { user } = useAuth();

  const storeId = localStorage.getItem("store_id");

  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [usd, setUsd] = useState("");

  const [status, setStatus] = useState<null | "OK" | "NO_OPEN_CUT">(null);

  async function cerrar() {
    if (!storeId) {
      alert("No hay sucursal definida");
      return;
    }

    const { data, error } = await supabase.rpc(
      "close_cash_register_client",
      {
        p_store_id: storeId,
        p_user_name: user?.email || "Cajero",
        p_cash_declared: Number(cash || 0),
        p_card_declared: Number(card || 0),
        p_usd_declared: Number(usd || 0),
      }
    );

    if (error) {
      alert("Error al cerrar caja: " + error.message);
      return;
    }

    setStatus(data);
  }

  if (status === "NO_OPEN_CUT") {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold">
          No hay caja abierta para este usuario
        </h2>
      </div>
    );
  }

  if (status === "OK") {
    return (
      <div className="p-6">
        <h2 className="text-lg font-bold mb-4">
          Caja cerrada correctamente
        </h2>

        <div className="border p-4 rounded">
          <p>Efectivo declarado: ${cash}</p>
          <p>Tarjeta declarada: ${card}</p>
          <p>USD declarados: ${usd}</p>

          <p className="mt-4 text-sm text-gray-600">
            Este comprobante contiene únicamente
            la información capturada por el cajero.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md">
      <h2 className="text-lg font-bold mb-4">
        Cierre de Caja
      </h2>

      <div className="space-y-3">
        <div>
          <label className="block text-sm">Efectivo contado</label>
          <input
            className="border p-2 w-full"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm">Tarjeta contado</label>
          <input
            className="border p-2 w-full"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm">USD contado</label>
          <input
            className="border p-2 w-full"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
          />
        </div>

        <button
          className="bg-green-600 text-white px-4 py-2 w-full"
          onClick={cerrar}
        >
          Cerrar caja
        </button>
      </div>
    </div>
  );
}
