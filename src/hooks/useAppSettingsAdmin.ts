import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SettingsMap {
  polling_interval_seconds: number;
  jackpot_duration_seconds: number;
}

const DEFAULTS: SettingsMap = {
  polling_interval_seconds: 10,
  jackpot_duration_seconds: 10,
};

export function useAppSettingsAdmin() {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const merged = { ...DEFAULTS };
    for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
      if (
        row.key === "polling_interval_seconds" &&
        typeof row.value === "number"
      ) {
        merged.polling_interval_seconds = row.value;
      } else if (
        row.key === "jackpot_duration_seconds" &&
        typeof row.value === "number"
      ) {
        merged.jackpot_duration_seconds = row.value;
      }
    }
    setSettings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateSetting = useCallback(
    async (key: keyof SettingsMap, value: number) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { settings, loading, error, updateSetting };
}
