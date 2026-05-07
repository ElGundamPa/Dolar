import type { Team } from "@/types";

// SoundHelix is a free CC test track. Replaced in admin once per-agent uploads are configured.
const MOCK_SONG = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

const portrait = (seed: string) =>
  `https://i.pravatar.cc/240?u=${encodeURIComponent(seed)}`;

export const mockTeams: Team[] = [
  {
    id: "mesa-1",
    name: "Mesa 1 — Bank Vault",
    goal: 75_000,
    iconUrl: null,
    displayOrder: 0,
    total: 0,
    agents: [
      { id: "a1", name: "Sofía Reyes", photoUrl: portrait("sofia"), songUrl: MOCK_SONG, songStartSeconds: 12, teamId: "mesa-1", displayOrder: 0, total: 18_400 },
      { id: "a2", name: "Mateo Cárdenas", photoUrl: portrait("mateo"), songUrl: MOCK_SONG, songStartSeconds: 30, teamId: "mesa-1", displayOrder: 1, total: 14_900 },
      { id: "a3", name: "Lucía Vargas", photoUrl: portrait("lucia"), songUrl: MOCK_SONG, songStartSeconds: 45, teamId: "mesa-1", displayOrder: 2, total: 11_200 },
      { id: "a4", name: "Diego Marín", photoUrl: portrait("diego"), songUrl: MOCK_SONG, songStartSeconds: 60, teamId: "mesa-1", displayOrder: 3, total: 7_650 },
      { id: "a5", name: "Camila Ortíz", photoUrl: portrait("camila"), songUrl: MOCK_SONG, songStartSeconds: 8, teamId: "mesa-1", displayOrder: 4, total: 4_300 },
    ],
  },
  {
    id: "mesa-2",
    name: "Mesa 2 — Reserve Desk",
    goal: 60_000,
    iconUrl: null,
    displayOrder: 1,
    total: 0,
    agents: [
      { id: "b1", name: "Valentina Solís", photoUrl: portrait("valentina"), songUrl: MOCK_SONG, songStartSeconds: 22, teamId: "mesa-2", displayOrder: 0, total: 16_750 },
      { id: "b2", name: "Joaquín Peña", photoUrl: portrait("joaquin"), songUrl: MOCK_SONG, songStartSeconds: 38, teamId: "mesa-2", displayOrder: 1, total: 12_300 },
      { id: "b3", name: "Renata Aguirre", photoUrl: portrait("renata"), songUrl: MOCK_SONG, songStartSeconds: 50, teamId: "mesa-2", displayOrder: 2, total: 9_800 },
      { id: "b4", name: "Bruno Salas", photoUrl: portrait("bruno"), songUrl: MOCK_SONG, songStartSeconds: 70, teamId: "mesa-2", displayOrder: 3, total: 5_100 },
      { id: "b5", name: "Antonia Rivas", photoUrl: portrait("antonia"), songUrl: MOCK_SONG, songStartSeconds: 18, teamId: "mesa-2", displayOrder: 4, total: 2_900 },
    ],
  },
].map((team) => {
  const total = team.agents.reduce((sum, a) => sum + a.total, 0);
  return {
    ...team,
    total,
    dia: null,
    semana: null,
    mes: total,
  };
});
