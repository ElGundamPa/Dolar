import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { AgentRow, TeamRow } from "@/types/database";

export interface AgentInput {
  id?: string;
  name: string;
  team_id: string;
  display_order: number;
  photo_url: string | null;
  song_url: string | null;
  song_start_seconds: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export function useAgentsAdmin() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, t] = await Promise.all([
      supabase.from("agents").select("*").order("display_order"),
      supabase.from("teams").select("*").order("display_order"),
    ]);
    if (a.error || t.error) {
      setError(a.error?.message ?? t.error?.message ?? "load error");
    } else {
      setAgents((a.data ?? []) as AgentRow[]);
      setTeams((t.data ?? []) as TeamRow[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertAgent = useCallback(
    async (input: AgentInput) => {
      const payload = {
        name: input.name.trim(),
        team_id: input.team_id,
        display_order: input.display_order,
        photo_url: input.photo_url,
        song_url: input.song_url,
        song_start_seconds: input.song_start_seconds,
      };
      if (input.id) {
        const { error } = await supabase
          .from("agents")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert(payload);
        if (error) throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const deleteAgent = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const uploadPhoto = useCallback(
    async (agentName: string, file: File): Promise<string> => {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${slugify(agentName)}.${ext}`;
      const { error } = await supabase.storage
        .from("agent-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("agent-photos").getPublicUrl(path);
      return `${data.publicUrl}?v=${Date.now()}`;
    },
    [],
  );

  const uploadSong = useCallback(
    async (agentName: string, file: File): Promise<string> => {
      const ext = (file.name.split(".").pop() ?? "mp3").toLowerCase();
      const path = `${slugify(agentName)}.${ext}`;
      const { error } = await supabase.storage
        .from("agent-songs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("agent-songs").getPublicUrl(path);
      return `${data.publicUrl}?v=${Date.now()}`;
    },
    [],
  );

  return {
    agents,
    teams,
    loading,
    error,
    refresh,
    upsertAgent,
    deleteAgent,
    uploadPhoto,
    uploadSong,
  };
}
