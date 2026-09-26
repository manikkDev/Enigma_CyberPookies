import { ENDPOINTS } from "@/config/endpoints";

const authHeaders = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const json = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || `Request failed with ${response.status}`);
  return body;
};

export type RoundEvent = {
  event: "start" | "round" | "end" | "error";
  run_id: string;
  round?: number;
  num_rounds?: number;
  strategy?: string;
  global?: { roc_auc: number; pr_auc: number; f1: number; loss: number; ece: number; recall_at_p90?: number };
  privacy?: { dp_enabled: boolean; epsilon: number | null; delta: number; noise_multiplier: number; clipping_norm: number; secagg: boolean };
  final?: Record<string, unknown>;
};

export const api = {
  fl: {
    start: (config: Record<string, unknown>) => fetch(`${ENDPOINTS.fl}/start`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(config) }).then(json),
    stop: (id: string) => fetch(`${ENDPOINTS.fl}/stop/${encodeURIComponent(id)}`, { method: "POST", headers: authHeaders() }).then(json),
    runs: () => fetch(`${ENDPOINTS.fl}/runs`, { headers: authHeaders() }).then(json),
    status: (id: string) => fetch(`${ENDPOINTS.fl}/status/${encodeURIComponent(id)}`, { headers: authHeaders() }).then(json),
    summary: () => fetch(`${ENDPOINTS.fl}/summary`, { headers: authHeaders() }).then(json),
    predict: (body: unknown) => fetch(`${ENDPOINTS.fl}/predict`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) }).then(json),
    customers: (query: Record<string, string>) => fetch(`${ENDPOINTS.fl}/customers?${new URLSearchParams(query)}`, { headers: authHeaders() }).then(json),
    stream: (id: string, onEvent: (event: RoundEvent) => void) => {
      const stream = new EventSource(ENDPOINTS.flStream(id));
      stream.addEventListener("progress", (message) => onEvent(JSON.parse((message as MessageEvent).data)));
      return () => stream.close();
    },
  },
  graph: {
    overview: (minScore = 0.3, limit = 400) => fetch(`${ENDPOINTS.riskGraphOverview}?minScore=${minScore}&limit=${limit}`).then(json),
    campaigns: () => fetch(ENDPOINTS.riskGraphCampaigns).then(json),
    campaign: (id: number) => fetch(ENDPOINTS.riskGraphCampaign(id)).then(json),
    neighbors: (pid: string) => fetch(ENDPOINTS.riskGraphNeighbors(pid)).then(json),
  },
  consent: {
    me: () => fetch(`${ENDPOINTS.consent}/me`, { headers: authHeaders() }).then(json),
    set: (purpose: string, granted: boolean) => fetch(ENDPOINTS.consent, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ purpose, granted }) }).then(json),
    erase: () => fetch(`${ENDPOINTS.consent}/erase-request`, { method: "POST", headers: authHeaders() }).then(json),
  },
};
