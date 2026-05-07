import { useState } from "react";
import { useAgentsAdmin } from "@/hooks/useAgentsAdmin";
import type { AgentRow } from "@/types/database";
import { AgentDialog } from "./AgentDialog";

export function AgentsTab() {
  const {
    agents,
    teams,
    loading,
    error,
    upsertAgent,
    deleteAgent,
    uploadPhoto,
    uploadSong,
  } = useAgentsAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentRow | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (a: AgentRow) => {
    setEditing(a);
    setDialogOpen(true);
  };
  const confirmDelete = async (a: AgentRow) => {
    if (!confirm(`Borrar a "${a.name}"?`)) return;
    try {
      await deleteAgent(a.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-widest text-cyan-glow">
            Agentes
          </h2>
          <p className="text-sm text-vault-silver/60">
            {agents.length} agente{agents.length === 1 ? "" : "s"} ·{" "}
            {teams.length} mesa{teams.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          disabled={teams.length === 0}
          className="btn btn-primary"
        >
          + Agregar agente
        </button>
      </div>

      {teams.length === 0 && (
        <p className="mb-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 text-sm text-[var(--color-warning)]">
          Aún no hay mesas. Andá a la pestaña <strong>Mesas</strong> y creá al
          menos una antes de agregar agentes.
        </p>
      )}

      {error && (
        <p className="field-error mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="vault-card scrollbar-thin overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16">Foto</th>
              <th>Nombre</th>
              <th>Mesa</th>
              <th className="text-right">Orden</th>
              <th>Canción</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center text-vault-silver/60">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && agents.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-vault-silver/60">
                  Sin agentes. Agregá el primero con el botón de arriba.
                </td>
              </tr>
            )}
            {agents.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="h-10 w-10 overflow-hidden rounded-md border border-vault-blue/40 bg-[var(--bg-elevated)]">
                    {a.photo_url ? (
                      <img
                        src={a.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-vault-blue">
                        {a.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </td>
                <td className="font-semibold text-[var(--text-primary)]">
                  {a.name}
                </td>
                <td className="text-[var(--color-accent)]">
                  {teamById.get(a.team_id)?.name ?? a.team_id}
                </td>
                <td className="text-right text-[var(--text-secondary)] tabular-nums">
                  {a.display_order}
                </td>
                <td>
                  {a.song_url ? (
                    <span className="badge badge-success">
                      ✓ {Number(a.song_start_seconds).toFixed(1)}s
                    </span>
                  ) : (
                    <span className="badge badge-muted">sin MP3</span>
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="btn btn-secondary btn-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(a)}
                      className="btn btn-danger btn-sm"
                    >
                      Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AgentDialog
        open={dialogOpen}
        initial={editing}
        teams={teams}
        onClose={() => setDialogOpen(false)}
        onSubmit={upsertAgent}
        uploadPhoto={uploadPhoto}
        uploadSong={uploadSong}
      />
    </div>
  );
}
