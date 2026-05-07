import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TeamRow } from "@/types/database";

export interface TeamInput {
  id: string;
  name: string;
  goal: number;
  display_order: number;
  icon_url: string | null;
}

export function useTeamsAdmin() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("display_order");
    if (error) setError(error.message);
    else {
      setTeams((data ?? []) as TeamRow[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertTeam = useCallback(
    async (input: TeamInput, isNew: boolean) => {
      if (isNew) {
        const { error } = await supabase.from("teams").insert(input);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teams")
          .update({
            name: input.name,
            goal: input.goal,
            display_order: input.display_order,
            icon_url: input.icon_url,
          })
          .eq("id", input.id);
        if (error) throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      const { count } = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("team_id", id);
      if (count && count > 0) {
        throw new Error(
          `No se puede borrar: ${count} agente(s) asignados a esta mesa.`,
        );
      }
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { teams, loading, error, refresh, upsertTeam, deleteTeam };
}
