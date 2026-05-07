import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AgentRow, TeamRow } from "@/types/database";

interface AgentsState {
  agents: AgentRow[];
  teams: TeamRow[];
  loading: boolean;
  error: string | null;
}

export function useAgents() {
  const [state, setState] = useState<AgentsState>({
    agents: [],
    teams: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [agentsRes, teamsRes] = await Promise.all([
        supabase.from("agents").select("*").order("display_order"),
        supabase.from("teams").select("*").order("display_order"),
      ]);
      if (!mounted) return;
      if (agentsRes.error || teamsRes.error) {
        setState({
          agents: [],
          teams: [],
          loading: false,
          error: agentsRes.error?.message ?? teamsRes.error?.message ?? null,
        });
        return;
      }
      setState({
        agents: agentsRes.data ?? [],
        teams: teamsRes.data ?? [],
        loading: false,
        error: null,
      });
    };
    load();

    const channel = supabase
      .channel("agents-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        load,
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
