export interface Agent {
  id: string;
  name: string;
  photoUrl: string | null;
  songUrl: string | null;
  songStartSeconds: number;
  teamId: string;
  displayOrder: number;
  total: number;
}

export interface Team {
  id: string;
  name: string;
  goal: number;
  iconUrl: string | null;
  displayOrder: number;
  total: number;
  /** Total del día desde "Tabla" col I. `null` si el sheet no lo trae. */
  dia: number | null;
  /** Total de la semana desde "Tabla" col J. */
  semana: number | null;
  /** Total del mes desde "Tabla" col K. */
  mes: number | null;
  agents: Agent[];
}

export interface Sale {
  id: string;
  agentName: string;
  entryDate: string;
  value: number;
}

export interface JackpotEvent {
  agent: Agent;
  amount: number;
  triggeredAt: number;
}
