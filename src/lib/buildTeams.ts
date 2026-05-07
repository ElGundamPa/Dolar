import type { Agent, Team } from "@/types";
import type { AgentRow, TeamRow } from "@/types/database";
import type { SheetPayload } from "@/hooks/useGoogleSheetData";

const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Merges the live Apps Script payload (totals + per-agent sales) with the
 * Supabase agents table (photos, songs, start times, team assignment, order).
 * Source-of-truth for *who exists* is Supabase; for *how much they sold* is the Sheet.
 */
export function buildTeams(
  supaAgents: AgentRow[],
  supaTeams: TeamRow[],
  sheet: SheetPayload | null,
): Team[] {
  const salesByAgent = new Map<string, number>();
  // Match por nombre normalizado: el id del sheet es un slug del Apps Script
  // y no coincide con el UUID de Supabase.
  const statsByTeamName = new Map<
    string,
    { total: number | null; dia: number | null; semana: number | null; mes: number | null }
  >();
  for (const t of sheet?.teams ?? []) {
    const key = norm(t.name);
    statsByTeamName.set(key, {
      total: typeof t.total_real === "number" ? t.total_real : null,
      dia: typeof t.dia === "number" ? t.dia : null,
      semana: typeof t.semana === "number" ? t.semana : null,
      mes: typeof t.mes === "number" ? t.mes : null,
    });
    for (const a of t.agents ?? []) {
      salesByAgent.set(norm(a.name), Number(a.sales) || 0);
    }
  }

  return supaTeams
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((t) => {
      const teamAgents: Agent[] = supaAgents
        .filter((a) => a.team_id === t.id)
        .sort((a, b) => a.display_order - b.display_order)
        .map((row) => ({
          id: row.id,
          name: row.name,
          photoUrl: row.photo_url,
          songUrl: row.song_url,
          songStartSeconds: Number(row.song_start_seconds) || 0,
          teamId: row.team_id,
          displayOrder: row.display_order,
          total: salesByAgent.get(norm(row.name)) ?? 0,
        }));

      const stats = statsByTeamName.get(norm(t.name));
      const total =
        stats?.total ??
        teamAgents.reduce((sum, a) => sum + a.total, 0);

      return {
        id: t.id,
        name: t.name,
        goal: Number(t.goal),
        iconUrl: t.icon_url,
        displayOrder: t.display_order,
        total,
        dia: stats?.dia ?? null,
        semana: stats?.semana ?? null,
        mes: stats?.mes ?? null,
        agents: teamAgents,
      };
    });
}
