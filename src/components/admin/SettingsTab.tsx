import { useEffect, useState } from "react";
import { useAppSettingsAdmin } from "@/hooks/useAppSettingsAdmin";
import { useJackpotSfx } from "@/hooks/useJackpotSfx";

export function SettingsTab() {
  const { settings, loading, error, updateSetting } = useAppSettingsAdmin();
  const sfx = useJackpotSfx();
  const [polling, setPolling] = useState(10);
  const [duration, setDuration] = useState(10);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(sfx.isMuted());
  const [master, setMasterValue] = useState<number>(sfx.getMaster());

  useEffect(() => {
    setPolling(settings.polling_interval_seconds);
    setDuration(settings.jackpot_duration_seconds);
  }, [settings]);

  const save = async (
    key: "polling_interval_seconds" | "jackpot_duration_seconds",
    value: number,
  ) => {
    setBusyKey(key);
    try {
      await updateSetting(key, value);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-2xl uppercase tracking-widest text-cyan-glow">
          Configuración
        </h2>
        <p className="text-sm text-vault-silver/60">
          Tunables del dashboard. Los cambios se aplican en vivo.
        </p>
      </div>

      {error && (
        <p className="field-error mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="vault-card grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
        <div>
          <label htmlFor="cfg-polling" className="field-label">
            Intervalo de polling (s)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="cfg-polling"
              type="number"
              min="3"
              value={polling}
              onChange={(e) => setPolling(parseInt(e.target.value, 10) || 10)}
              disabled={loading}
              className="field-input max-w-[140px]"
            />
            <button
              type="button"
              onClick={() => save("polling_interval_seconds", polling)}
              disabled={busyKey === "polling_interval_seconds"}
              className="btn btn-primary btn-sm"
            >
              {busyKey === "polling_interval_seconds" ? "..." : "Guardar"}
            </button>
            {savedKey === "polling_interval_seconds" && (
              <span
                className="self-center text-sm font-semibold text-[var(--color-success)]"
                role="status"
              >
                ✓ guardado
              </span>
            )}
          </div>
          <p className="field-help">
            Cada cuánto consulta la hoja de Google. Mínimo 3 segundos.
          </p>
        </div>

        <div>
          <label htmlFor="cfg-duration" className="field-label">
            Duración del jackpot (s)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="cfg-duration"
              type="number"
              min="3"
              max="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 10)}
              disabled={loading}
              className="field-input max-w-[140px]"
            />
            <button
              type="button"
              onClick={() => save("jackpot_duration_seconds", duration)}
              disabled={busyKey === "jackpot_duration_seconds"}
              className="btn btn-primary btn-sm"
            >
              {busyKey === "jackpot_duration_seconds" ? "..." : "Guardar"}
            </button>
            {savedKey === "jackpot_duration_seconds" && (
              <span
                className="self-center text-sm font-semibold text-[var(--color-success)]"
                role="status"
              >
                ✓ guardado
              </span>
            )}
          </div>
          <p className="field-help">
            Tiempo total de la animación cuando entra una venta nueva.
          </p>
        </div>

        <div className="md:col-span-2">
          <p className="field-label">Audio</p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-vault-silver">
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => {
                  setMuted(e.target.checked);
                  sfx.setMuted(e.target.checked);
                }}
              />
              Mute global
            </label>
            <label className="flex items-center gap-3 text-sm text-vault-silver">
              <span className="uppercase tracking-widest text-xs text-vault-blue/70">
                Volumen
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={master}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setMasterValue(v);
                  sfx.setMaster(v);
                }}
                className="accent-vault-blue"
              />
              <span className="font-digital tabular-nums text-vault-platinum">
                {Math.round(master * 100)}%
              </span>
            </label>
          </div>
          <p className="field-help">
            Mute y volumen se guardan en localStorage y se aplican a la animación
            de “máquina expulsando dinero”. Si dejás MP3 en{" "}
            <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[12px] text-[var(--color-primary-hover)]">
              /public/sounds/
            </code>{" "}
            se usan en lugar del sintetizador.
          </p>
        </div>

        <div className="md:col-span-2">
          <p className="field-label">URL del Apps Script</p>
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Vive como Edge Function secret (
              <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[12px] text-[var(--color-primary-hover)]">
                APPS_SCRIPT_URL
              </code>
              ). Para cambiarla:
            </p>
            <pre className="mt-3 overflow-x-auto rounded bg-[var(--bg-elevated)] p-3 font-mono text-[12px] leading-relaxed text-[var(--color-primary-hover)]">
{`supabase secrets set APPS_SCRIPT_URL="https://script.google.com/.../exec"
supabase functions deploy google-sheets-proxy --no-verify-jwt`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
