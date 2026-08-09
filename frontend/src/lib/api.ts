// NEXT_PUBLIC_API_URL is inlined at build time. When it's not provided at build
// (e.g. the ZopCloud build didn't pass it as a build arg), fall back to the
// deployed backend rather than localhost so the browser hits a reachable API.
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://gitpulse-backend-753284.zopcloud.zop.dev";

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export const api = {
  getTraffic: (from?: string, to?: string) => {
    let url = "/api/traffic";
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (params.toString()) url += `?${params}`;
    return fetchAPI<any[]>(url);
  },
  getSummary: () => fetchAPI<any>("/api/summary"),
  getIssues: () => fetchAPI<any[]>("/api/issues"),
  getPulls: () => fetchAPI<any[]>("/api/pulls"),
  getContributors: () => fetchAPI<any[]>("/api/contributors"),
  getCommits: () => fetchAPI<any[]>("/api/commits"),
  getReleases: () => fetchAPI<any[]>("/api/releases"),
  getLanguages: () => fetchAPI<Record<string, number>>("/api/languages"),
  getReferrers: () => fetchAPI<any[]>("/api/referrers"),
  getPaths: () => fetchAPI<any[]>("/api/paths"),
  // New integrations
  getGoModStats: () => fetchAPI<any>("/api/gomod/stats"),
  getScorecard: () => fetchAPI<any>("/api/scorecard"),
  getSocialMentions: () => fetchAPI<any>("/api/social/mentions"),
  getDerivedMetrics: () => fetchAPI<any>("/api/derived/metrics"),
};
