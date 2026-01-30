import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SpecialPricingSettings = {
  enabled: boolean;
  start: string; // HH:mm
  end: string;   // HH:mm
  multiplier: number;
};

export type AppSettings = {
  usdExchangeRate: number | null;
  specialPricing: SpecialPricingSettings | null;
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    usdExchangeRate: null,
    specialPricing: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const map = new Map<string, any>();
    data?.forEach((row: any) => {
      map.set(row.key, row.value);
    });

    const usdExchangeRate =
      map.has("usd_exchange_rate") && map.get("usd_exchange_rate") !== null
        ? Number(map.get("usd_exchange_rate"))
        : null;

    const specialPricing =
      map.has("special_pricing") && map.get("special_pricing") !== null
        ? {
            enabled: Boolean(map.get("special_pricing")?.enabled),
            start: map.get("special_pricing")?.start ?? "00:00",
            end: map.get("special_pricing")?.end ?? "23:59",
            multiplier: Number(
              map.get("special_pricing")?.multiplier ?? 1
            ),
          }
        : null;

    setSettings({
      usdExchangeRate,
      specialPricing,
    });

    setLoading(false);
  }

  return {
    settings,
    loading,
    error,
    reload: loadSettings,
  };
}
