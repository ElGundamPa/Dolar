import { motion } from "framer-motion";
import type { Agent } from "@/types";
import { HexBadge } from "./HexBadge";
import { formatCurrency } from "@/lib/utils";

interface AgentRowProps {
  agent: Agent;
  rank: number;
}

export function AgentRow({ agent, rank }: AgentRowProps) {
  const isPodium = rank <= 3;
  const photoSize = "clamp(2.25rem, 6vw, 3rem)";
  const badgeSize = "clamp(2.25rem, 6vw, 3rem)";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="flex min-w-0 items-center gap-3 rounded-md border border-vault-iron bg-vault-graphite/60 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3"
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: badgeSize, height: badgeSize }}
        aria-label={`Ranking ${rank}`}
      >
        {isPodium ? (
          <HexBadge rank={rank as 1 | 2 | 3} size={48} className="h-full w-full" />
        ) : (
          <span
            className="font-display tabular-nums text-vault-silver/70"
            style={{ fontSize: "clamp(1rem, 2.5vw, 1.5rem)" }}
          >
            {rank}
          </span>
        )}
      </div>

      <div
        className="relative shrink-0 overflow-hidden rounded-md ring-1 ring-vault-blue/60"
        style={{ width: photoSize, height: photoSize }}
      >
        {agent.photoUrl ? (
          <img
            src={agent.photoUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-vault-steel font-display text-vault-blue-bright"
            style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.25rem)" }}
            aria-hidden
          >
            {agent.name.charAt(0)}
          </div>
        )}
      </div>

      <p
        className="min-w-0 flex-1 truncate font-sans font-semibold text-vault-platinum"
        style={{ fontSize: "clamp(0.95rem, 2vw, 1.125rem)" }}
        title={agent.name}
      >
        {agent.name}
      </p>

      <p
        className="shrink-0 font-digital tabular-nums text-cyan-glow"
        style={{ fontSize: "clamp(1rem, 2.4vw, 1.25rem)" }}
      >
        {formatCurrency(agent.total)}
      </p>
    </motion.li>
  );
}
