import { useMemo } from "react";
import type { Team } from "@/types";
import { TeamCard } from "./TeamCard";
import { NeonText } from "./NeonText";
import { BrandMark } from "./BrandMark";
import { BRAND } from "@/config/branding";
import { formatCurrency } from "@/lib/utils";

interface DashboardViewProps {
  teams: Team[];
}

export function DashboardView({ teams }: DashboardViewProps) {
  const houseTotal = useMemo(
    () => teams.reduce((sum, t) => sum + t.total, 0),
    [teams],
  );
  const houseGoal = useMemo(
    () => teams.reduce((sum, t) => sum + t.goal, 0),
    [teams],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-vault-blue/30 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <BrandMark size={48} />
          <div className="min-w-0">
            <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-vault-blue/70 sm:text-xs">
              Trading Vault
            </p>
            <h1
              className="truncate font-display leading-none text-cyan-glow"
              style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)" }}
            >
              {BRAND.name.toUpperCase()}
            </h1>
          </div>
        </div>

        <div className="order-3 flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto">
          <span
            className="anim-live-pulse h-2.5 w-2.5 rounded-full"
            style={{
              background: "var(--color-danger)",
              boxShadow:
                "0 0 10px var(--color-danger), 0 0 20px var(--color-danger)",
            }}
          />
          <NeonText color="danger" className="text-2xl sm:text-3xl">
            LIVE
          </NeonText>
        </div>

        <div className="text-right">
          <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-vault-silver/60 sm:text-xs">
            Total Volume
          </p>
          <p
            className="font-digital text-cyan-glow"
            style={{ fontSize: "clamp(1.75rem, 5vw, 3rem)" }}
          >
            {formatCurrency(houseTotal)}
          </p>
          <p className="font-sans text-[11px] text-vault-silver/50 sm:text-xs">
            target {formatCurrency(houseGoal)}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {teams.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center font-sans text-base text-vault-silver/60 sm:text-lg">
              No hay mesas configuradas. Andá a{" "}
              <a
                href="/admin"
                className="text-vault-blue underline underline-offset-4"
              >
                /admin
              </a>{" "}
              para crear una.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4 sm:gap-5 lg:gap-6"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            }}
          >
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
