import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PROCESSED_SALES_LIMIT } from "@/config/constants";
import { logger } from "@/lib/logger";
import type { Sale } from "@/types";

const STORAGE_KEY = "dolar-processed-sales-v1";
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/** Shape returned by the Apps Script `doGet`. */
export interface SheetTeam {
  id: string;
  name: string;
  goal: number;
  total_real?: number;
  dia?: number;
  semana?: number;
  mes?: number;
  agents: Array<{ id: string; name: string; sales: number; teamId: string }>;
}
export interface SheetSale {
  agentName: string;
  entryDate: string;
  value: number;
  /** ISO string del Timestamp de Form Responses 1 (cuándo se envió el form). */
  submittedAt?: string | null;
}
export interface SheetPayload {
  teams: SheetTeam[];
  newSales: SheetSale[];
}

/** Si una venta tiene Timestamp dentro de esta ventana, dispara animación
 *  aunque sea el primer poll (cubre el caso "agrego venta y abro dashboard"). */
const SALE_FRESHNESS_MS = 10 * 60 * 1000;

interface State {
  data: SheetPayload | null;
  error: string | null;
  lastFetchedAt: number | null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** ID estable para dedupe entre sesiones.
 *  Usa submittedAt si existe (más estable que entryDate.toString() que cambia
 *  según locale del Apps Script). Cae a entryDate como fallback. */
const saleId = (s: SheetSale) =>
  `${norm(s.agentName)}|${s.submittedAt || s.entryDate}|${s.value}`;

const loadProcessedFromStorage = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { entries: string[]; savedAt: number };
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.entries) ||
      Date.now() - parsed.savedAt > STORAGE_TTL_MS
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.entries;
  } catch {
    return [];
  }
};

const saveProcessedToStorage = (entries: string[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ entries, savedAt: Date.now() }),
    );
  } catch {
    /* quota / privacy mode: degradación silenciosa a in-memory */
  }
};

export function useGoogleSheetData(opts: {
  pollingIntervalSeconds: number;
  enabled: boolean;
  onNewSale?: (sale: Sale) => void;
}) {
  const { pollingIntervalSeconds, enabled, onNewSale } = opts;
  const [state, setState] = useState<State>({
    data: null,
    error: null,
    lastFetchedAt: null,
  });

  const isFirstLoad = useRef(true);
  // Hidratamos `processed` desde localStorage para que recargar la página
  // no replayé las animaciones del día.
  const processed = useRef<Set<string>>(
    new Set(loadProcessedFromStorage()),
  );
  const processedQueue = useRef<string[]>([...processed.current]);
  const onNewSaleRef = useRef(onNewSale);
  onNewSaleRef.current = onNewSale;

  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const { data, error } = await supabase.functions.invoke<SheetPayload>(
          "google-sheets-proxy",
          { method: "GET" },
        );
        if (cancelled) return;
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Empty payload");
        const maybeErr = (data as unknown as { error?: unknown }).error;
        if (typeof maybeErr === "string") {
          throw new Error(maybeErr);
        }
        if (!Array.isArray(data.teams) || !Array.isArray(data.newSales)) {
          throw new Error("Invalid payload shape");
        }

        logger.info("sheet fetch", {
          teams: data.teams.length,
          newSales: data.newSales.length,
          firstLoad: isFirstLoad.current,
          processedSize: processed.current.size,
        });

        let processedChanged = false;

        for (const sale of data.newSales) {
          if (!sale.agentName || !sale.value) continue;
          const id = saleId(sale);

          // Ya procesada en sesión actual o sesiones previas → nunca replay.
          if (processed.current.has(id)) continue;

          processed.current.add(id);
          processedQueue.current.push(id);
          while (processedQueue.current.length > PROCESSED_SALES_LIMIT) {
            const oldest = processedQueue.current.shift();
            if (oldest) processed.current.delete(oldest);
          }
          processedChanged = true;

          const submittedMs = sale.submittedAt
            ? Date.parse(sale.submittedAt)
            : NaN;
          const isFresh =
            !isNaN(submittedMs) &&
            Date.now() - submittedMs < SALE_FRESHNESS_MS;

          // Animar si:
          //  (a) sesión activa (no es el primer poll), o
          //  (b) venta fresca (Timestamp del form < 10 min).
          // Nunca replay: estar en `processed` (memoria + localStorage) ya filtró arriba.
          const shouldFire = !isFirstLoad.current || isFresh;

          if (shouldFire) {
            logger.info("new sale detected", {
              id,
              isFresh,
              submittedAt: sale.submittedAt,
            });
            onNewSaleRef.current?.({
              id,
              agentName: sale.agentName,
              entryDate: sale.entryDate,
              value: sale.value,
            });
          } else {
            logger.info("seed sale (no animation, stale)", {
              id,
              submittedAt: sale.submittedAt,
            });
          }
        }

        if (processedChanged) {
          saveProcessedToStorage(processedQueue.current);
        }
        isFirstLoad.current = false;
        setState({ data, error: null, lastFetchedAt: Date.now() });
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : String(err);
        logger.error("sheet fetch failed", raw);
        setState((prev) => ({ ...prev, error: raw }));
      }
    };

    fetchRef.current = fetchOnce;
    fetchOnce();
    const id = window.setInterval(
      fetchOnce,
      Math.max(3, pollingIntervalSeconds) * 1000,
    );

    // Cuando la pestaña vuelve a foreground, refetch inmediato.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        fetchOnce();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, pollingIntervalSeconds]);

  const refetch = useCallback(() => {
    fetchRef.current();
  }, []);

  return { ...state, refetch };
}
