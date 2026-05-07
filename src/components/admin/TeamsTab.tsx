import { useEffect, useState } from "react";
import { useTeamsAdmin, type TeamInput } from "@/hooks/useTeamsAdmin";
import type { TeamRow } from "@/types/database";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function TeamRowEdit({
  initial,
  onSave,
  onCancel,
}: {
  initial: TeamRow | null;
  onSave: (input: TeamInput, isNew: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [goal, setGoal] = useState(Number(initial?.goal ?? 50000));
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [id, setId] = useState(initial?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initial && name && !id) setId(slugify(name) || "mesa-x");
  }, [name, id, initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !id.trim()) {
      setError("Nombre e id son requeridos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          id: id.trim(),
          name: name.trim(),
          goal,
          display_order: order,
          icon_url: initial?.icon_url ?? null,
        },
        !initial,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-3 rounded-md border border-[var(--color-accent)]/40 bg-[var(--bg-elevated)]/40 p-4 md:grid-cols-[1.2fr_1.5fr_1fr_0.6fr_auto]"
      noValidate
    >
      <div>
        <label className="field-label">ID</label>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={!!initial}
          placeholder="mesa-x"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label" data-required="true">Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mesa X"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Meta ($)</label>
        <input
          type="number"
          value={goal}
          onChange={(e) => setGoal(parseFloat(e.target.value) || 0)}
          placeholder="50000"
          className="field-input"
        />
      </div>
      <div>
        <label className="field-label">Orden</label>
        <input
          type="number"
          value={order}
          onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
          placeholder="0"
          className="field-input"
        />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-ghost btn-sm"
          aria-label="Cancelar"
        >
          ✕
        </button>
      </div>
      {error && (
        <p className="field-error md:col-span-5" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function TeamsTab() {
  const { teams, loading, error, upsertTeam, deleteTeam } = useTeamsAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const onDelete = async (t: TeamRow) => {
    if (!confirm(`Borrar mesa "${t.name}"?`)) return;
    try {
      await deleteTeam(t.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-widest text-cyan-glow">
            Mesas
          </h2>
          <p className="text-sm text-vault-silver/60">
            {teams.length} mesa{teams.length === 1 ? "" : "s"} configurada
            {teams.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
          }}
          className="btn btn-primary"
        >
          + Agregar mesa
        </button>
      </div>

      {error && (
        <p className="field-error mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="vault-card space-y-3 p-4">
        {loading && <p className="text-vault-silver/60">Cargando…</p>}

        {creating && (
          <TeamRowEdit
            initial={null}
            onSave={async (i, isNew) => {
              await upsertTeam(i, isNew);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {!loading && !creating && teams.length === 0 && (
          <p className="py-6 text-center text-vault-silver/60">
            Sin mesas. Agregá la primera.
          </p>
        )}

        {teams.map((t) => (
          <div
            key={t.id}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/30 p-3"
          >
            {editingId === t.id ? (
              <TeamRowEdit
                initial={t}
                onSave={async (i, isNew) => {
                  await upsertTeam(i, isNew);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1.2fr_1.5fr_1fr_0.6fr_auto]">
                <span className="font-mono text-xs text-[var(--color-accent)]">
                  {t.id}
                </span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {t.name}
                </span>
                <span className="tabular-nums text-[var(--text-secondary)]">
                  ${Number(t.goal).toLocaleString()}
                </span>
                <span className="text-[var(--text-muted)]">
                  orden {t.display_order}
                </span>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(t.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    className="btn btn-danger btn-sm"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
