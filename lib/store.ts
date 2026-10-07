import { create } from "zustand";
import { persist, StateStorage, createJSONStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";
import type { FlowMethod } from "@/lib/pump-calc";

// IndexedDB storage adapter for Zustand — keeps field data on the device
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export type CompanyProfile = {
  id: string;
  companyName: string;
  area: string;
  district: string;
  state: string;
  pincode: string;
  updatedAt: string;
};

/**
 * One pump test — one column of the PUMPS_Transit / PUMPS_Doppler sheet.
 * Only the readings are stored; every calculated value comes from
 * calculatePump() so the formulas live in one place.
 */
export type PumpTest = {
  id: string;
  method: FlowMethod;

  // Pump description
  pumpTag: string; // "PUMP DESCRIPTION"
  location?: string | null;
  typeSize?: string | null;
  make?: string | null;
  ratedHead?: number | null; // m
  ratedFlow?: number | null; // m3/h
  impellerDia?: number | null; // mm
  ratedPowerHp?: number | null; // HP (Doppler sheet)

  // Transit meter set-up
  transducerModel?: string | null; // TM-1 or TS2
  pipeMaterial?: string | null;
  transducerMounting?: string | null; // V / Z / W method
  transducerSpacing?: number | null; // mm

  // Readings
  measuredFlowM3h?: number | null; // Transit
  measuredVelocity?: number | null; // Doppler
  pipePeriphery?: number | null; // mm
  dischargePressure?: number | null; // kg/cm2
  suctionPressure?: number | null; // kg/cm2
  pipeThickness?: number | null; // mm
  waterDensity?: number | null; // kg/m3
  gravity?: number | null; // m/s2
  inputPowerKw?: number | null; // Pe
  frequencyHz?: number | null;
  motorEfficiency?: number | null; // %
  valveOpenPct?: number | null; // %

  // Friction loss (Hazen-Williams)
  pipeType?: string | null;
  hwCoefficient?: number | null;
  straightLengthM?: number | null;
  fittings?: Record<string, number> | null;

  description?: string | null;
  recordedBy?: string | null;
  photoPath?: string | null;
  createdAt: string;
};

export type SyncJob = {
  jobId: string;
  status: "pending" | "synced";
  createdAt: number;
  reporterName: string;
  payload: {
    profile: CompanyProfile | null;
    pumps: PumpTest[];
  };
};

type AppState = {
  profile: CompanyProfile | null;
  pumps: PumpTest[];
  syncQueue: SyncJob[];

  setProfile: (profile: CompanyProfile) => void;

  addPump: (pump: PumpTest) => void;
  updatePump: (id: string, pump: Partial<PumpTest>) => void;
  deletePump: (id: string) => void;
  replacePumps: (pumps: PumpTest[]) => void;

  wipeData: () => void;

  addJobToQueue: (job: SyncJob) => void;
  updateJobStatus: (jobId: string, status: "pending" | "synced") => void;
  pruneQueue: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      pumps: [],
      syncQueue: [],

      setProfile: (profile) => set({ profile }),

      addPump: (pump) => set((state) => ({ pumps: [...state.pumps, pump] })),
      updatePump: (id, updated) =>
        set((state) => ({
          pumps: state.pumps.map((p) => (p.id === id ? { ...p, ...updated } : p)),
        })),
      deletePump: (id) => set((state) => ({ pumps: state.pumps.filter((p) => p.id !== id) })),
      replacePumps: (pumps) => set({ pumps }),

      wipeData: () => set({ profile: null, pumps: [], syncQueue: [] }),

      addJobToQueue: (job) =>
        set((state) => {
          // Hard cap at 50 to prevent IndexedDB bloat
          const newQueue = [job, ...state.syncQueue];
          if (newQueue.length > 50) newQueue.length = 50;
          return { syncQueue: newQueue };
        }),

      updateJobStatus: (jobId, status) =>
        set((state) => ({
          syncQueue: state.syncQueue.map((job) => (job.jobId === jobId ? { ...job, status } : job)),
        })),

      pruneQueue: () =>
        set((state) => {
          const now = Date.now();
          const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
          return {
            syncQueue: state.syncQueue.filter(
              // Keep pending jobs OR synced jobs younger than 48 hours
              (job) => job.status === "pending" || now - job.createdAt < FORTY_EIGHT_HOURS,
            ),
          };
        }),
    }),
    {
      name: "pump-up-offline-storage",
      storage: createJSONStorage(() => idbStorage),
    },
  ),
);
