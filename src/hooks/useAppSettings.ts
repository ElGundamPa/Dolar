import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AppSettings {
  polling_interval_seconds: number;
  jackpot_duration_seconds: number;
}

const DEFAULTS: AppSettings = {
  polling_interval_seconds: 10,
  jackpot_duration_seconds: 10,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value");
      if (!mounted) return;
      const merged = { ...DEFAULTS };
      const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
      for (const row of rows) {
        const v = row.value;
        if (row.key === "polling_interval_seconds" && typeof v === "number") {
          merged.polling_interval_seconds = v;
        } else if (
          row.key === "jackpot_duration_seconds" &&
          typeof v === "number"
        ) {
          merged.jackpot_duration_seconds = v;
        }
      }
      setSettings(merged);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("app-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        load,
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading };
}
