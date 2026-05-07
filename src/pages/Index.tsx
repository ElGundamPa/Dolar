import { useEffect, useMemo, useState } from "react";
import { VaultBackground } from "@/components/dashboard/VaultBackground";
import { StartScreen } from "@/components/dashboard/StartScreen";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { JackpotOverlay } from "@/components/dashboard/JackpotOverlay";
import { useAgents } from "@/hooks/useAgents";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useGoogleSheetData } from "@/hooks/useGoogleSheetData";
import { buildTeams } from "@/lib/buildTeams";
import { mockTeams } from "@/config/mockData";
import { logger } from "@/lib/logger";
import type { Agent, JackpotEvent, Sale, Team } from "@/types";

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const synthAgentFromSale = (sale: Sale): Agent => ({
  id: `synth-${norm(sale.agentName)}`,
  name: sale.agentName,
  photoUrl: null,
  songUrl: null,
  songStartSeconds: 0,
  teamId: "",
  displayOrder: 0,
  total: sale.value,
});

export default function Index() {
  const [entered, setEntered] = useState(false);
  const [queue, setQueue] = useState<JackpotEvent[]>([]);
  const [current, setCurrent] = useState<JackpotEvent | null>(null);

  const { agents, teams: teamRows, error: agentsError } = useAgents();
  const { settings } = useAppSettings();

  const sheet = useGoogleSheetData({
    pollingIntervalSeconds: settings.polling_interval_seconds,
    enabled: entered,
    onNewSale: (sale: Sale) => {
      logger.info("Base_Agregada → animación", {
        agente: sale.agentName,
        monto: sale.value,
        entryDate: sale.entryDate,
      });
      const liveAgents = teamRows.length
        ? buildTeams(agents, teamRows, null).flatMap((t) => t.agents)
        : mockTeams.flatMap((t) => t.agents);
      const match = liveAgents.find((a) => norm(a.name) === norm(sale.agentName));
      const agentForJackpot: Agent = match ?? synthAgentFromSale(sale);
      if (!match) {
        logger.warn(
          "Sale agent not found in Supabase agents — using synthetic agent for animation",
          { sheetAgent: sale.agentName, supaAgents: liveAgents.map((a) => a.name) },
        );
      }
      logger.info("disparando jackpot", {
        agente: agentForJackpot.name,
        monto: sale.value,
      });
      setQueue((q) => [
        ...q,
        { agent: agentForJackpot, amount: sale.value, triggeredAt: Date.now() },
      ]);
    },
  });

  const liveTeams = useMemo<Team[]>(() => {
    if (!teamRows.length) return mockTeams;
    return buildTeams(agents, teamRows, sheet.data);
  }, [agents, teamRows, sheet.data]);

  // Serial queue: only one jackpot animation runs at a time.
  useEffect(() => {
    if (current || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
  }, [current, queue]);

  return (
    <div className="relative h-full w-full">
      <VaultBackground />

      {!entered ? (
        <StartScreen onEnter={() => setEntered(true)} />
      ) : (
        <DashboardView teams={liveTeams} />
      )}

      <JackpotOverlay
        event={current}
        onComplete={() => setCurrent(null)}
        durationMs={settings.jackpot_duration_seconds * 1000}
      />

      {entered && (agentsError || sheet.error) && (
        <div className="fixed bottom-4 left-4 z-40 max-w-sm rounded-md border border-vault-danger bg-black/80 px-4 py-2 text-xs text-vault-danger">
          {agentsError && <div>DB: error de conexión</div>}
          {sheet.error && <div>Sheet: error de sincronización</div>}
        </div>
      )}
    </div>
  );
}
