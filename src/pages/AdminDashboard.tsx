import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { BRAND } from "@/config/branding";
import { AgentsTab } from "@/components/admin/AgentsTab";
import { TeamsTab } from "@/components/admin/TeamsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";

type Tab = "agents" | "teams" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "agents", label: "Agentes" },
  { id: "teams", label: "Mesas" },
  { id: "settings", label: "Configuración" },
];

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <div className="bg-vault-pattern relative h-full w-full overflow-auto p-6 text-vault-platinum">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandMark size={48} />
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.4em] text-vault-blue/70">
              Admin Console
            </p>
            <h1 className="font-display text-3xl text-cyan-glow">
              {BRAND.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-vault-silver/70">{user?.email}</span>
          <Link
            to="/"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="btn btn-danger btn-sm"
          >
            Salir
          </button>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Admin sections"
        className="mb-6 flex gap-1 border-b border-vault-blue/30"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "relative px-5 py-3 font-display text-sm uppercase tracking-widest transition-colors " +
                (active
                  ? "text-cyan-glow"
                  : "text-vault-silver/55 hover:text-vault-platinum")
              }
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-[3px] rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--color-primary), transparent)",
                    boxShadow: "0 0 12px var(--color-primary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === "agents" && <AgentsTab />}
        {tab === "teams" && <TeamsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
