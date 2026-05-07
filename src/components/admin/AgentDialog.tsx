import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentRow, TeamRow } from "@/types/database";
import type { AgentInput } from "@/hooks/useAgentsAdmin";

interface AgentDialogProps {
  open: boolean;
  initial: AgentRow | null;
  teams: TeamRow[];
  onClose: () => void;
  onSubmit: (input: AgentInput) => Promise<void>;
  uploadPhoto: (name: string, file: File) => Promise<string>;
  uploadSong: (name: string, file: File) => Promise<string>;
}

export function AgentDialog({
  open,
  initial,
  teams,
  onClose,
  onSubmit,
  uploadPhoto,
  uploadSong,
}: AgentDialogProps) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [order, setOrder] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [songStart, setSongStart] = useState(0);
  const [busy, setBusy] = useState<"photo" | "song" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; team?: string }>({});
  const [previewing, setPreviewing] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const songInput = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const PREVIEW_MS = 8000;

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setTeamId(initial?.team_id ?? teams[0]?.id ?? "");
    setOrder(initial?.display_order ?? 0);
    setPhotoUrl(initial?.photo_url ?? null);
    setSongUrl(initial?.song_url ?? null);
    setSongStart(Number(initial?.song_start_seconds) || 0);
    setError(null);
    setFieldErrors({});
    setBusy(null);
  }, [open, initial, teams]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handlePhotoFile = async (file: File) => {
    if (!name.trim()) {
      setFieldErrors({ name: "Ingresá un nombre antes de subir foto." });
      return;
    }
    setBusy("photo");
    setError(null);
    try {
      const url = await uploadPhoto(name, file);
      setPhotoUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleSongFile = async (file: File) => {
    if (!name.trim()) {
      setFieldErrors({ name: "Ingresá un nombre antes de subir canción." });
      return;
    }
    setBusy("song");
    setError(null);
    try {
      const url = await uploadSong(name, file);
      setSongUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  /**
   * Detiene cualquier preview en curso y libera el elemento Audio.
   * Idempotente — seguro de llamar varias veces.
   */
  const stopPreview = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    const a = previewAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
      a.src = "";
      a.removeAttribute("src");
      a.load();
      a.onended = null;
      a.onerror = null;
      previewAudioRef.current = null;
    }
    setPreviewing(false);
  }, []);

  const togglePreview = useCallback(() => {
    if (!songUrl) return;
    if (previewing) {
      stopPreview();
      return;
    }
    stopPreview();

    const audio = new Audio(songUrl);
    audio.preload = "auto";
    audio.volume = 0.6;
    previewAudioRef.current = audio;

    const seek = () => {
      try {
        audio.currentTime = songStart;
      } catch {
        /* ignore */
      }
    };
    audio.addEventListener("loadedmetadata", seek, { once: true });
    audio.onended = () => stopPreview();
    audio.onerror = () => stopPreview();

    setPreviewing(true);
    audio
      .play()
      .then(() => {
        if (audio.currentTime < songStart - 0.05) seek();
      })
      .catch(() => stopPreview());

    previewTimerRef.current = window.setTimeout(stopPreview, PREVIEW_MS);
  }, [songUrl, songStart, previewing, stopPreview]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  useEffect(() => {
    if (!open) stopPreview();
  }, [open, stopPreview]);

  useEffect(() => {
    stopPreview();
  }, [songUrl, stopPreview]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio.";
    if (!teamId) errs.team = "Seleccioná una mesa.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy("save");
    setError(null);
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        team_id: teamId,
        display_order: order,
        photo_url: photoUrl,
        song_url: songUrl,
        song_start_seconds: songStart,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-dialog-title"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="modal-card"
        noValidate
      >
        <div className="modal-header">
          <div>
            <h2 id="agent-dialog-title" className="modal-title">
              {initial ? "Editar agente" : "Nuevo agente"}
            </h2>
            <p className="modal-subtitle">
              El nombre debe coincidir exactamente con la columna B del Sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="agent-name" className="field-label" data-required="true">
                Nombre
              </label>
              <input
                id="agent-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((s) => ({ ...s, name: undefined }));
                }}
                placeholder="Ej. Alexis"
                autoFocus
                aria-invalid={!!fieldErrors.name}
                aria-describedby={fieldErrors.name ? "agent-name-err" : undefined}
                className="field-input"
              />
              {fieldErrors.name && (
                <p id="agent-name-err" className="field-error" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="agent-team" className="field-label" data-required="true">
                Mesa
              </label>
              <select
                id="agent-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                aria-invalid={!!fieldErrors.team}
                aria-describedby={fieldErrors.team ? "agent-team-err" : undefined}
                className="field-select"
              >
                {teams.length === 0 && <option value="">— sin mesas —</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {fieldErrors.team && (
                <p id="agent-team-err" className="field-error" role="alert">
                  {fieldErrors.team}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="agent-order" className="field-label">
                Orden de pizarra
              </label>
              <input
                id="agent-order"
                type="number"
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="field-input"
              />
              <p className="field-help">Menor número = más arriba en la mesa.</p>
            </div>

            <div>
              <label htmlFor="agent-song-start" className="field-label">
                Inicio de canción (s)
              </label>
              <input
                id="agent-song-start"
                type="number"
                step="0.1"
                min="0"
                value={songStart}
                onChange={(e) => setSongStart(parseFloat(e.target.value) || 0)}
                placeholder="0.0"
                className="field-input"
              />
              <p className="field-help">Segundo desde el cual arranca el MP3.</p>
            </div>
          </div>

          <hr className="my-6 border-vault-blue/15" />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="field-label">Foto</p>
              <div className="flex items-center gap-3">
                <div
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-vault-blue/60 bg-[var(--bg-elevated)]"
                  role="img"
                  aria-label={photoUrl ? `Foto de ${name}` : "Sin foto"}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-vault-blue/70">
                      ?
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={busy === "photo"}
                    className="btn btn-secondary btn-sm"
                  >
                    {busy === "photo" ? "Subiendo…" : photoUrl ? "Cambiar" : "Subir foto"}
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl(null)}
                      className="btn btn-ghost btn-sm"
                    >
                      Quitar
                    </button>
                  )}
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <p className="field-help">JPG, PNG o WebP.</p>
            </div>

            <div>
              <p className="field-label">Canción de celebración</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => songInput.current?.click()}
                  disabled={busy === "song"}
                  className="btn btn-secondary btn-sm"
                >
                  {busy === "song"
                    ? "Subiendo…"
                    : songUrl
                      ? "Cambiar MP3"
                      : "Subir MP3"}
                </button>
                {songUrl && (
                  <>
                    <button
                      type="button"
                      onClick={togglePreview}
                      className="btn btn-secondary btn-sm"
                      aria-pressed={previewing}
                    >
                      {previewing ? "■ Detener preview" : "▶ Probar 8s"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopPreview();
                        setSongUrl(null);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      Quitar
                    </button>
                  </>
                )}
                <input
                  ref={songInput}
                  type="file"
                  accept="audio/mpeg,audio/mp3"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSongFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {songUrl && (
                <p className="field-help truncate">
                  {songUrl.split("/").pop()?.split("?")[0]}
                </p>
              )}
              <p className="field-help">Archivo de audio (MP3).</p>
            </div>
          </div>

          {error && (
            <p className="field-error mt-4" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy === "save"}
            className="btn btn-primary"
          >
            {busy === "save" ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
