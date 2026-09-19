import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SpecialPricing = {
  enabled: boolean;
  start: string;
  end: string;
  percent: number | "";
};

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [usdRate, setUsdRate] = useState<number | "">("");
  const [specialPricing, setSpecialPricing] = useState<SpecialPricing>({
    enabled: false,
    start: "",
    end: "",
    percent: "",
  });

  /* ===============================
     CARGAR CONFIGURACIÓN
  =============================== */
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value");

      if (error) {
        setError("No se pudo cargar la configuración.");
        setLoading(false);
        return;
      }

      for (const row of data) {
        if (row.key === "usd_exchange_rate") {
          setUsdRate(row.value);
        }

        if (row.key === "special_pricing") {
          const multiplier = Number(row.value.multiplier ?? 1);

          setSpecialPricing({
            enabled: row.value.enabled ?? false,
            start: row.value.start ?? "",
            end: row.value.end ?? "",
            percent: Number(((multiplier - 1) * 100).toFixed(2)),
          });
        }
      }

      setLoading(false);
    };

    loadSettings();
  }, []);

  /* ===============================
     GUARDAR CONFIGURACIÓN
  =============================== */
  const saveSettings = async () => {
    setError(null);

    const operations = [
      supabase.from("app_settings").upsert({
        key: "usd_exchange_rate",
        value: usdRate,
      }),
      supabase.from("app_settings").upsert({
        key: "special_pricing",
        value: {
          enabled: specialPricing.enabled,
          start: specialPricing.start,
          end: specialPricing.end,
          multiplier: 1 + Number(specialPricing.percent) / 100,
        },
      }),
    ];

    const results = await Promise.all(operations);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      setError("No se pudo guardar la configuración.");
    }
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-1">Configuración</h1>
      <p className="text-gray-600 mb-6">
        Ajustes generales de la sucursal
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-100 text-red-700 p-3">
          {error}
        </div>
      )}

      {loading ? (
        <p>Cargando configuración...</p>
      ) : (
        <>
          {/* TIPO DE CAMBIO */}
          <div className="mb-6">
            <label className="block font-semibold mb-1">
              Tipo de cambio USD
            </label>
            <input
              type="number"
              step="0.01"
              value={usdRate}
              onChange={(e) =>
                setUsdRate(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="border rounded px-3 py-2 w-full"
              placeholder="Ej. 17.50"
            />
            <p className="text-sm text-gray-500 mt-1">
              Se usa para cobros en dólares y reportes.
            </p>
          </div>

          {/* AJUSTE POR HORARIO */}
          <div className="mb-6">
            <h2 className="font-semibold mb-2">
              Precio nocturno de cerveza
            </h2>

            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={specialPricing.enabled}
                onChange={(e) =>
                  setSpecialPricing({
                    ...specialPricing,
                    enabled: e.target.checked,
                  })
                }
              />
              Activo
            </label>

            <div className="flex gap-4 mb-3">
              <div className="flex-1">
                <label className="block text-sm mb-1">Inicio</label>
                <input
                  type="time"
                  value={specialPricing.start}
                  onChange={(e) =>
                    setSpecialPricing({
                      ...specialPricing,
                      start: e.target.value,
                    })
                  }
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm mb-1">Fin</label>
                <input
                  type="time"
                  value={specialPricing.end}
                  onChange={(e) =>
                    setSpecialPricing({
                      ...specialPricing,
                      end: e.target.value,
                    })
                  }
                  className="border rounded px-3 py-2 w-full"
                />
              </div>
            </div>

            <label className="block text-sm mb-1">
              Incremento nocturno (%)
            </label>
            <input
              type="number"
              value={specialPricing.percent}
              onChange={(e) =>
                setSpecialPricing({
                  ...specialPricing,
                  percent:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <button
            onClick={saveSettings}
            className="bg-gray-900 text-white px-6 py-2 rounded w-full"
          >
            Guardar configuración
          </button>
        </>
      )}
    </div>
  );
}
