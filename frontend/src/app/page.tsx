"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  Star, GitFork, Eye, Download, GitPullRequest, CircleDot,
  Users, Tag, Globe, Activity, ArrowUpRight, ExternalLink, AlertTriangle,
  Info, Code2, HardDrive, Calendar,
} from "lucide-react";

const COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#f43f5e", "#0ea5e9", "#a855f7", "#ec4899", "#84cc16"];

function fmt(d: string) {
  if (!d || d.length < 10) return d || "";
  return new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

const tipStyle: React.CSSProperties = {
  background: "#151520", border: "1px solid #22223a", borderRadius: 8,
  padding: "8px 12px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", fontSize: 12, color: "#c0c0d0",
};

const FILTER_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
];

function FilterBar({ active, onChange }: { active: number; onChange: (d: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {FILTER_OPTIONS.map(f => (
        <button key={f.label} onClick={() => onChange(f.days)}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer",
            border: "1px solid", transition: "all 0.15s",
            background: active === f.days ? "rgba(99,102,241,0.15)" : "transparent",
            borderColor: active === f.days ? "#6366f1" : "#1c1c2e",
            color: active === f.days ? "#818cf8" : "#555570",
          }}>{f.label}</button>
      ))}
    </div>
  );
}

function StateFilter({ options, active, onChange }: { options: { label: string; value: string; count?: number }[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer",
            border: "1px solid", transition: "all 0.15s",
            background: active === o.value ? "rgba(99,102,241,0.15)" : "transparent",
            borderColor: active === o.value ? "#6366f1" : "#1c1c2e",
            color: active === o.value ? "#818cf8" : "#555570",
          }}>{o.label}{o.count != null ? ` (${o.count})` : ""}</button>
      ))}
    </div>
  );
}

function filterByDays<T extends { date?: string; created_at?: string; week?: string }>(data: T[], days: number): T[] {
  if (days === 0 || !data.length) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter(item => {
    const d = item.date || item.created_at || item.week || "";
    if (d.length < 10) return true;
    return new Date(d.slice(0, 10)) >= cutoff;
  });
}

function SectionTitle({ icon: Icon, text, color }: { icon: any; text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: `${color}15` }}>
        <Icon size={14} color={color} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e8", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}

function EmptyBox({ text, height = 120 }: { text: string; height?: number }) {
  return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#3a3a50" }}>{text}</div>;
}

function fmtSize(kb?: number) {
  if (!kb) return null;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// A compact info pill used in the header meta row.
function MetaPill({ icon: Icon, label, color = "#6366f1" }: { icon?: React.ElementType; label: string; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7, background: "rgba(255,255,255,0.025)", border: "1px solid #1c1c2e", fontSize: 11, color: "#8a8aa0", whiteSpace: "nowrap" }}>
      {Icon ? <Icon size={12} color={color} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />}
      {label}
    </span>
  );
}

// Sticky in-page navigation with active-section highlighting (scroll-spy).
function NavBar({ items, active, onSelect }: { items: { id: string; label: string }[]; active: string; onSelect: (id: string) => void }) {
  return (
    <nav style={{ position: "sticky", top: 0, zIndex: 20, margin: "0 -32px 24px", padding: "10px 32px", background: "rgba(11,11,18,0.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid #16161f" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 1380, margin: "0 auto" }}>
        {items.map(it => {
          const on = it.id === active;
          return (
            <a key={it.id} href={`#${it.id}`} onClick={() => onSelect(it.id)}
              style={{
                display: "inline-flex", alignItems: "center", cursor: "pointer",
                padding: "6px 13px", borderRadius: 8, fontSize: 12.5,
                fontWeight: on ? 600 : 500,
                color: on ? "#c7d2fe" : "#8a8aa0",
                background: on ? "rgba(99,102,241,0.16)" : "transparent",
                border: `1px solid ${on ? "rgba(99,102,241,0.45)" : "transparent"}`,
                boxShadow: on ? "0 0 0 1px rgba(99,102,241,0.1), 0 2px 8px rgba(99,102,241,0.18)" : "none",
                textDecoration: "none", transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!on) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#d0d0e0"; } }}
              onMouseLeave={e => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8a8aa0"; } }}>
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// A simple pulsing skeleton block reusing the card chrome.
function Skel({ height = 120, style }: { height?: number; style?: React.CSSProperties }) {
  return <div style={{ height, borderRadius: 14, background: "#111119", border: "1px solid #1c1c2e", animation: "pulse 1.4s ease-in-out infinite", ...style }} />;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [pulls, setPulls] = useState<any[]>([]);
  const [contributors, setContributors] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [referrers, setReferrers] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [gomodStats, setGomodStats] = useState<any>(null);
  const [scorecard, setScorecard] = useState<any>(null);
  const [socialData, setSocialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [trafficDays, setTrafficDays] = useState(0); // 0 = All
  const [issueDays, setIssueDays] = useState(0);
  const [prDays, setPrDays] = useState(0);
  const [commitDays, setCommitDays] = useState(0);
  const [issueState, setIssueState] = useState("open"); // all, open, closed
  const [prState, setPrState] = useState("open"); // all, open, merged, closed
  const [socialFilter, setSocialFilter] = useState("all"); // all, hackernews, reddit, stackoverflow
  const [showAllReleases, setShowAllReleases] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  // Timestamp until which scroll-spy is suppressed (set on nav click so the
  // highlight doesn't flicker through intermediate sections during smooth scroll).
  const spyLockUntil = useRef(0);

  useEffect(() => {
    async function load() {
      try {
        const [s, t, i, p, c, cm, r, l, ref, pa, dm, gm, sc, so] = await Promise.allSettled([
          api.getSummary(), api.getTraffic(), api.getIssues(), api.getPulls(),
          api.getContributors(), api.getCommits(), api.getReleases(),
          api.getLanguages(), api.getReferrers(), api.getPaths(),
          api.getDerivedMetrics(), api.getGoModStats(), api.getScorecard(), api.getSocialMentions(),
        ]);
        if (s.status === "fulfilled") setSummary(s.value);
        if (t.status === "fulfilled") setTraffic(t.value || []);
        if (i.status === "fulfilled") setIssues(i.value || []);
        if (p.status === "fulfilled") setPulls(p.value || []);
        if (c.status === "fulfilled") setContributors(c.value || []);
        if (cm.status === "fulfilled") setCommits(cm.value || []);
        if (r.status === "fulfilled") setReleases(r.value || []);
        if (l.status === "fulfilled") setLanguages(l.value || {});
        if (ref.status === "fulfilled") setReferrers(ref.value || []);
        if (pa.status === "fulfilled") setPaths(pa.value || []);
        if (dm.status === "fulfilled") setMetrics(dm.value);
        if (gm.status === "fulfilled") setGomodStats(gm.value);
        if (sc.status === "fulfilled") setScorecard(sc.value);
        if (so.status === "fulfilled") setSocialData(so.value);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const repoName = summary?.repo || "";

  const openIssues = useMemo(() => issues.filter(i => i.state === "open"), [issues]);
  const openPRs = useMemo(() => pulls.filter(p => p.state === "open"), [pulls]);
  const mergedPRs = useMemo(() => pulls.filter(p => p.merged_at), [pulls]);
  const totalCommits = useMemo(() => commits.reduce((s, w) => s + (w.total || 0), 0), [commits]);

  const langData = useMemo(() => {
    const total = Object.values(languages).reduce((a, b) => a + b, 0);
    return Object.entries(languages).sort(([, a], [, b]) => b - a)
      .map(([name, bytes]) => ({ name, bytes, pct: total > 0 ? (bytes / total) * 100 : 0 }));
  }, [languages]);

  // Filtered data
  const realTraffic = useMemo(() => traffic.filter(t => (t.clones || 0) > 0 || (t.views || 0) > 0), [traffic]);
  const filteredTraffic = useMemo(() => filterByDays(realTraffic, trafficDays).map(t => ({ ...t, label: fmt(t.date) })), [realTraffic, trafficDays]);
  const filteredIssues = useMemo(() => {
    let filtered = filterByDays(issues, issueDays);
    if (issueState === "open") filtered = filtered.filter(i => i.state === "open");
    else if (issueState === "closed") filtered = filtered.filter(i => i.state === "closed");
    return filtered;
  }, [issues, issueDays, issueState]);

  const filteredPulls = useMemo(() => {
    let filtered = filterByDays(pulls, prDays);
    if (prState === "open") filtered = filtered.filter(p => p.state === "open");
    else if (prState === "merged") filtered = filtered.filter(p => p.merged_at);
    else if (prState === "closed") filtered = filtered.filter(p => p.state === "closed" && !p.merged_at);
    return filtered;
  }, [pulls, prDays, prState]);

  const filteredMentions = useMemo(() => {
    if (!socialData?.mentions) return [];
    if (socialFilter === "all") return socialData.mentions;
    return socialData.mentions.filter((m: any) => m.source === socialFilter);
  }, [socialData, socialFilter]);
  const filteredCommits = useMemo(() => filterByDays(commits, commitDays).map(c => ({ ...c, label: fmt(c.week) })), [commits, commitDays]);

  const fTotalClones = useMemo(() => filteredTraffic.reduce((s, t) => s + (t.clones || 0), 0), [filteredTraffic]);
  const fTotalUC = useMemo(() => filteredTraffic.reduce((s, t) => s + (t.unique_cloners || 0), 0), [filteredTraffic]);
  const fTotalViews = useMemo(() => filteredTraffic.reduce((s, t) => s + (t.views || 0), 0), [filteredTraffic]);
  const fTotalUV = useMemo(() => filteredTraffic.reduce((s, t) => s + (t.unique_visitors || 0), 0), [filteredTraffic]);

  const hasRealData = (summary?.stars || 0) > 0 || realTraffic.length > 0 ||
    contributors.length > 0 || issues.length > 0 || commits.length > 0 || langData.length > 0;

  const latestDate = useMemo(() => {
    const dates = realTraffic.map(t => t.date).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : "";
  }, [realTraffic]);

  const hasScorecard = !!scorecard?.score;
  const hasGoMod = !!gomodStats?.version_count;
  const hasSocial = !!(socialData && socialData.total_mentions > 0);
  const hasContent = referrers.length > 0 || paths.length > 0;

  const navItems = useMemo(() => {
    const items = [
      { id: "overview", label: "Overview" },
      { id: "traffic", label: "Traffic" },
      { id: "health", label: "Health" },
    ];
    if (metrics) items.push({ id: "community", label: "Community" });
    if (hasSocial) items.push({ id: "social", label: "Social" });
    if (hasContent) items.push({ id: "content", label: "Content" });
    items.push({ id: "activity", label: "Activity" });
    items.push({ id: "people", label: "Contributors" });
    items.push({ id: "tracker", label: "Issues & PRs" });
    items.push({ id: "releases", label: "Releases" });
    return items;
  }, [metrics, hasSocial, hasContent]);

  // Scroll-spy: highlight the nav item for the section currently under the nav bar.
  // Position-based (not IntersectionObserver) so the active tab reflects the section
  // you're actually looking at, with no off-by-one lag.
  useEffect(() => {
    if (loading) return;
    const ids = navItems.map(it => it.id);
    // A section is "active" once its top passes just below the sticky nav.
    const THRESHOLD = 96;

    function computeActive() {
      if (Date.now() < spyLockUntil.current) return;
      // At the very bottom of the page, force the last section active (its top
      // may never reach the threshold if it's short).
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        setActiveSection(ids[ids.length - 1]);
        return;
      }
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= THRESHOLD) current = id;
        else break; // sections are in document order — the rest are further down
      }
      setActiveSection(current);
    }

    computeActive();
    window.addEventListener("scroll", computeActive, { passive: true });
    window.addEventListener("resize", computeActive);
    return () => {
      window.removeEventListener("scroll", computeActive);
      window.removeEventListener("resize", computeActive);
    };
  }, [navItems, loading]);

  // On nav click: set the target active immediately and briefly suppress scroll-spy
  // so the highlight doesn't jump through sections passed during the smooth scroll.
  const handleNavSelect = (id: string) => {
    setActiveSection(id);
    spyLockUntil.current = Date.now() + 800;
  };

  if (loading) {
    return (
      <div style={{ background: "#0b0b12", minHeight: "100vh", color: "#c0c0d0" }}>
        <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
        <div style={{ maxWidth: 1380, margin: "0 auto", padding: "40px 32px" }}>
          {/* Header skeleton */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <Skel height={42} style={{ width: 42, borderRadius: 12 }} />
            <div style={{ flex: 1 }}>
              <Skel height={20} style={{ width: 220, marginBottom: 8, borderRadius: 6 }} />
              <Skel height={12} style={{ width: 140, borderRadius: 6 }} />
            </div>
          </div>
          <Skel height={40} style={{ marginBottom: 24, borderRadius: 8 }} />
          {/* Stat cards skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skel key={i} height={76} />)}
          </div>
          {/* Chart skeleton */}
          <Skel height={400} style={{ marginBottom: 24 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skel key={i} height={220} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0b0b12", minHeight: "100vh", color: "#c0c0d0" }}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } } @keyframes ping { 0% { transform: scale(1); opacity: 0.75; } 75%,100% { transform: scale(2.6); opacity: 0; } } @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); } 50% { box-shadow: 0 0 8px 1px rgba(34,197,94,0.55); } } html { scroll-behavior: smooth; }`}</style>
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: "40px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
          {/* Left: logo + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer"
              style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: "linear-gradient(140deg, rgba(129,140,248,0.30) 0%, rgba(99,102,241,0.18) 45%, rgba(6,182,212,0.16) 100%)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                border: "1px solid rgba(165,180,252,0.35)",
                boxShadow: "0 4px 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -8px 16px rgba(6,182,212,0.10)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px) scale(1.05)"; e.currentTarget.style.boxShadow = "0 7px 26px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -8px 16px rgba(6,182,212,0.16)"; e.currentTarget.style.borderColor = "rgba(165,180,252,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -8px 16px rgba(6,182,212,0.10)"; e.currentTarget.style.borderColor = "rgba(165,180,252,0.35)"; }}>
              <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-label="cloudemu Analytics">
                <defs>
                  <linearGradient id="logoBars" x1="6" y1="18" x2="18" y2="7" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e0e7ff" />
                    <stop offset="55%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#67e8f9" />
                  </linearGradient>
                  <linearGradient id="logoCloud" x1="3" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="100%" stopColor="#7dd3fc" />
                  </linearGradient>
                </defs>
                {/* cloud body (cloudemu) */}
                <path d="M17.5 19.5H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
                  fill="rgba(255,255,255,0.07)" stroke="url(#logoCloud)" strokeWidth="1.4" strokeLinejoin="round" />
                {/* ascending bars (analytics) */}
                <rect x="8" y="13" width="2" height="3.3" rx="1" fill="url(#logoBars)" fillOpacity="0.8" />
                <rect x="11" y="11" width="2" height="5.3" rx="1" fill="url(#logoBars)" fillOpacity="0.92" />
                <rect x="14" y="9" width="2" height="7.3" rx="1" fill="url(#logoBars)" />
              </svg>
            </a>
            <div>
              <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.02em", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#818cf8"}
                onMouseLeave={e => e.currentTarget.style.color = "#f0f0f5"}>
                {repoName.split("/")[1] || repoName} Analytics
              </a>
              <p style={{ fontSize: 12, color: "#555570", marginTop: 2 }}>
                <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1", textDecoration: "none" }}>{repoName}</a>
              </p>
            </div>
          </div>

          {/* Middle: repo description + meta pills (fills the empty band) */}
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 11 }}>
            {summary?.description && (
              <p style={{
                fontSize: 13.5, color: "#aab0c8", lineHeight: 1.55, margin: 0, maxWidth: 560,
                fontWeight: 400, letterSpacing: "0.005em",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>{summary.description}</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {summary?.language && <MetaPill icon={Code2} label={summary.language} color={COLORS[0]} />}
              {fmtSize(summary?.size) && <MetaPill icon={HardDrive} label={fmtSize(summary?.size)!} color="#a855f7" />}
              {(summary?.watchers ?? 0) > 0 && <MetaPill icon={Eye} label={`${summary.watchers.toLocaleString()} watching`} color="#0ea5e9" />}
              {latestDate && <MetaPill icon={Calendar} label={`Data through ${fmt(latestDate)}`} color="#14b8a6" />}
            </div>
          </div>

          {/* Right: live status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 9, flexShrink: 0, alignSelf: "flex-start",
            padding: "5px 12px 5px 11px", borderRadius: 999,
            background: hasRealData ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${hasRealData ? "rgba(34,197,94,0.28)" : "rgba(245,158,11,0.28)"}`,
          }}>
            <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
              {hasRealData && (
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#22c55e", animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
              )}
              <span style={{
                position: "relative", width: 8, height: 8, borderRadius: "50%",
                background: hasRealData ? "#22c55e" : "#f59e0b",
                animation: hasRealData ? "glow 2s ease-in-out infinite" : "pulse 1.6s ease-in-out infinite",
              }} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: hasRealData ? "#4ade80" : "#fbbf24" }}>
              {hasRealData ? "Live" : "Awaiting data"}
            </span>
          </div>
        </div>

        {/* Sticky in-page navigation */}
        <NavBar items={navItems} active={activeSection} onSelect={handleNavSelect} />

        {!hasRealData && (
          <div style={{ background: "#18150e", border: "1px solid #2e2810", borderRadius: 14, padding: "16px 20px", marginBottom: 24, display: "flex", gap: 12 }}>
            <AlertTriangle size={18} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>GitHub token required</p>
              <p style={{ fontSize: 12, color: "#9a8540", lineHeight: 1.6 }}>Set <code style={{ background: "#201c0a", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>GITHUB_TOKEN</code> in <code style={{ background: "#201c0a", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>configs/.env</code> and restart.</p>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div id="overview" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Stars", val: summary?.stars ?? 0, Icon: Star, color: "#eab308" },
            { label: "Forks", val: summary?.forks ?? 0, Icon: GitFork, color: "#6366f1" },
            { label: "Clones", val: summary?.total_clones ?? 0, Icon: Download, color: "#14b8a6" },
            { label: "Views", val: summary?.total_views ?? 0, Icon: Eye, color: "#0ea5e9" },
            { label: "Issues", val: openIssues.length, Icon: CircleDot, color: "#f43f5e" },
            { label: "PRs", val: openPRs.length, Icon: GitPullRequest, color: "#84cc16" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <s.Icon size={18} color={s.color} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555570", marginBottom: 2 }}>{s.label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#f0f0f5", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ───── Traffic Chart with Filter ───── */}
        <div id="traffic" style={{ scrollMarginTop: 70, background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <SectionTitle icon={Activity} text="Traffic" color="#14b8a6" />
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#555570", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#14b8a6", display: "inline-block" }} />Clones</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />Unique Cloners</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", display: "inline-block" }} />Views</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />Unique Visitors</span>
              </div>
              <FilterBar active={trafficDays} onChange={setTrafficDays} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px 24px", flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 20, fontWeight: 700, color: "#14b8a6" }}>{fTotalClones.toLocaleString()}</span><span style={{ fontSize: 11, color: "#555570", marginLeft: 6 }}>clones</span></div>
            <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 20, fontWeight: 700, color: "#6366f1" }}>{fTotalUC.toLocaleString()}</span><span style={{ fontSize: 11, color: "#555570", marginLeft: 6 }}>unique cloners</span></div>
            <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 20, fontWeight: 700, color: "#0ea5e9" }}>{fTotalViews.toLocaleString()}</span><span style={{ fontSize: 11, color: "#555570", marginLeft: 6 }}>views</span></div>
            <div style={{ whiteSpace: "nowrap" }}><span style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{fTotalUV.toLocaleString()}</span><span style={{ fontSize: 11, color: "#555570", marginLeft: 6 }}>unique visitors</span></div>
          </div>
          {filteredTraffic.length < 2 ? (
            <EmptyBox text="Traffic data will appear after the backend syncs" height={280} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={filteredTraffic}>
                <defs>
                  <linearGradient id="gClones" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.15} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="transparent" tick={{ fontSize: 10, fill: "#44445a" }} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fontSize: 10, fill: "#44445a" }} tickLine={false} width={32} />
                <Tooltip contentStyle={tipStyle} />
                <Area type="monotone" dataKey="clones" stroke="#14b8a6" strokeWidth={2} fill="url(#gClones)" dot={{ r: 2, fill: "#14b8a6" }} name="Clones" />
                <Area type="monotone" dataKey="unique_cloners" stroke="#6366f1" strokeWidth={2} fill="none" strokeDasharray="5 3" dot={{ r: 2, fill: "#6366f1" }} name="Unique Cloners" />
                <Area type="monotone" dataKey="views" stroke="#0ea5e9" strokeWidth={2} fill="url(#gViews)" dot={{ r: 2, fill: "#0ea5e9" }} name="Views" />
                <Area type="monotone" dataKey="unique_visitors" stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="5 3" dot={{ r: 2, fill: "#f59e0b" }} name="Unique Visitors" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ───── Health + (Scorecard or Repo Info) + Go Module ───── */}
        <div id="health" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#555570", marginBottom: 12 }}>Project Health</p>
            {metrics?.health_score != null ? (<>
              <p style={{ fontSize: 56, fontWeight: 800, color: metrics.health_score >= 70 ? "#22c55e" : metrics.health_score >= 40 ? "#f59e0b" : "#f43f5e", lineHeight: 1 }}>{metrics.health_score}</p>
              <p style={{ fontSize: 14, color: "#555570", marginTop: 4 }}>/ 100</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16, textAlign: "left" }}>
                <div><span style={{ fontSize: 10, color: "#555570" }}>Bus Factor</span><p style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e8" }}>{metrics.bus_factor}</p></div>
                <div><span style={{ fontSize: 10, color: "#555570" }}>Close Rate</span><p style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e8" }}>{metrics.issue_close_rate}%</p></div>
                <div><span style={{ fontSize: 10, color: "#555570" }}>Merge Time</span><p style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e8" }}>{metrics.median_merge_days}d</p></div>
                <div><span style={{ fontSize: 10, color: "#555570" }}>Stars/Day</span><p style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e8" }}>{metrics.star_growth_rate}</p></div>
              </div>
            </>) : <EmptyBox text="Computing..." height={140} />}
          </div>
          {hasScorecard ? (
            <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
              <SectionTitle icon={Activity} text="Security Scorecard" color="#22c55e" />
              <div style={{ marginTop: 12 }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}><span style={{ fontSize: 40, fontWeight: 800, color: scorecard.score >= 7 ? "#22c55e" : scorecard.score >= 4 ? "#f59e0b" : "#f43f5e" }}>{scorecard.score.toFixed(1)}</span><span style={{ fontSize: 16, color: "#555570" }}> / 10</span></div>
                <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {scorecard.checks?.slice(0, 8).map((c: any) => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#c0c0d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{c.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "monospace", color: c.score >= 7 ? "#22c55e" : c.score >= 4 ? "#f59e0b" : "#f43f5e" }}>{c.score}/10</span>
                    </div>))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
              <SectionTitle icon={Info} text="Repository Info" color="#6366f1" />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                {summary?.description && (
                  <p style={{ fontSize: 12.5, color: "#9a9ab0", lineHeight: 1.55, margin: 0 }}>{summary.description}</p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {summary?.language && (
                    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}>
                      <p style={{ fontSize: 10, color: "#555570", marginBottom: 4 }}>Language</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e8", display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: COLORS[0], display: "inline-block" }} />{summary.language}
                      </p>
                    </div>
                  )}
                  {fmtSize(summary?.size) && (
                    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}>
                      <p style={{ fontSize: 10, color: "#555570", marginBottom: 4 }}>Repo Size</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e8" }}>{fmtSize(summary?.size)}</p>
                    </div>
                  )}
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 10, color: "#555570", marginBottom: 4 }}>Watchers</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e8" }}>{(summary?.watchers ?? 0).toLocaleString()}</p>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 10, color: "#555570", marginBottom: 4 }}>Open Issues</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e8" }}>{(summary?.open_issues ?? openIssues.length).toLocaleString()}</p>
                  </div>
                </div>
                <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
                  View on GitHub <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          )}
          {hasGoMod && (
            <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
              <SectionTitle icon={Download} text="Go Module" color="#06b6d4" />
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}><p style={{ fontSize: 10, color: "#555570" }}>Versions</p><p style={{ fontSize: 22, fontWeight: 700, color: "#e0e0e8" }}>{gomodStats.version_count}</p></div>
                  <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12 }}><p style={{ fontSize: 10, color: "#555570" }}>Dependents</p><p style={{ fontSize: 22, fontWeight: 700, color: "#06b6d4" }}>{gomodStats.dependent_count || 0}</p></div>
                </div>
                <p style={{ fontSize: 11, color: "#555570" }}>Latest: <span style={{ color: "#e0e0e8", fontFamily: "monospace" }}>{gomodStats.latest_version}</span></p>
                {gomodStats.dependents?.length > 0 && <div style={{ marginTop: 12 }}><p style={{ fontSize: 10, color: "#555570", marginBottom: 6 }}>Used by:</p>
                  <div style={{ maxHeight: 80, overflowY: "auto" }}>{gomodStats.dependents.slice(0, 8).map((d: any, i: number) => (
                    <p key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#6366f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.module}</p>))}</div></div>}
              </div>
            </div>
          )}
        </div>

        {/* ───── Community Health Row ───── */}
        {metrics && (
          <div id="community" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Fork/Star Ratio", value: metrics.fork_star_ratio?.toFixed(2) || "0", sub: metrics.fork_star_ratio >= 0.2 ? "Active usage" : "Growing" },
              { label: "Release Cadence", value: metrics.release_cadence_days ? `${metrics.release_cadence_days}d` : "—", sub: "Avg between releases" },
              { label: "Issue Close Time", value: metrics.median_close_days ? `${metrics.median_close_days}d` : "—", sub: "Median close time" },
              { label: "Star Conversion", value: metrics.star_conversion_pct ? `${metrics.star_conversion_pct}%` : "—", sub: "Visitors → Stars" },
              { label: "Open Issues / PRs", value: `${metrics.open_issue_count || 0} / ${metrics.open_pr_count || 0}`, sub: `${metrics.merged_pr_count || 0} merged PRs` },
            ].map(m => (
              <div key={m.label} style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ fontSize: 10, color: "#555570", marginBottom: 6 }}>{m.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#e0e0e8" }}>{m.value}</p>
                <p style={{ fontSize: 10, color: "#3a3a50", marginTop: 4 }}>{m.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ───── Social Mentions ───── */}
        {hasSocial && (
          <div id="social" style={{ scrollMarginTop: 70, background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionTitle icon={Globe} text="Social Mentions" color="#a855f7" />
              <StateFilter active={socialFilter} onChange={setSocialFilter} options={[
                { label: "All", value: "all", count: socialData.total_mentions },
                { label: "HN", value: "hackernews", count: socialData.hn_mentions },
                { label: "Reddit", value: "reddit", count: socialData.reddit_posts },
                { label: "SO", value: "stackoverflow", count: socialData.so_questions },
              ]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10, maxHeight: 300, overflowY: "auto" }}>
              {filteredMentions.slice(0, 20).map((m: any, i: number) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
                  style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.015)", border: "1px solid #1c1c2e", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4,
                      background: m.source === "hackernews" ? "rgba(249,115,22,0.1)" : m.source === "reddit" ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.1)",
                      color: m.source === "hackernews" ? "#f97316" : m.source === "reddit" ? "#f43f5e" : "#6366f1" }}>{m.source}</span>
                    <span style={{ fontSize: 10, color: "#3a3a50" }}>{m.date}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#e0e0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#555570", marginTop: 4 }}>
                    <span>{m.points} pts</span><span>{m.comments} comments</span>{m.subreddit && <span>r/{m.subreddit}</span>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ───── Referrers + Popular Content ───── */}
        {hasContent && (
        <div id="content" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e8", marginBottom: 16 }}>Referring Sites</h2>
            {referrers.length === 0 ? <EmptyBox text="No referrer data" height={100} /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: "1px solid #1c1c2e" }}>
                <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Site</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Views</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Unique</th>
              </tr></thead><tbody>{referrers.map(r => (
                <tr key={r.referrer} style={{ borderBottom: "1px solid #14141e" }}>
                  <td style={{ fontSize: 13, fontWeight: 500, color: "#e0e0e8", padding: "10px 0" }}>{r.referrer}</td>
                  <td style={{ fontSize: 13, color: "#c0c0d0", textAlign: "right", padding: "10px 0" }}>{r.count}</td>
                  <td style={{ fontSize: 13, color: "#c0c0d0", textAlign: "right", padding: "10px 0" }}>{r.uniques}</td>
                </tr>))}</tbody></table>)}
          </div>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e8", marginBottom: 16 }}>Popular Content</h2>
            {paths.length === 0 ? <EmptyBox text="No page data" height={100} /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: "1px solid #1c1c2e" }}>
                <th style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Content</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Views</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#555570", padding: "8px 0" }}>Unique</th>
              </tr></thead><tbody>{paths.map(p => (
                <tr key={p.path} style={{ borderBottom: "1px solid #14141e" }}>
                  <td style={{ fontSize: 13, color: "#6366f1", padding: "10px 0", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</td>
                  <td style={{ fontSize: 13, color: "#c0c0d0", textAlign: "right", padding: "10px 0" }}>{p.count}</td>
                  <td style={{ fontSize: 13, color: "#c0c0d0", textAlign: "right", padding: "10px 0" }}>{p.uniques}</td>
                </tr>))}</tbody></table>)}
          </div>
        </div>
        )}

        {/* ───── Commits (with filter) + Languages ───── */}
        <div id="activity" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <SectionTitle icon={Activity} text="Weekly Commits" color="#6366f1" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
                <span style={{ fontSize: 11, color: "#555570", fontFamily: "monospace", whiteSpace: "nowrap" }}>{totalCommits} total</span>
                <FilterBar active={commitDays} onChange={setCommitDays} />
              </div>
            </div>
            {filteredCommits.length === 0 ? <EmptyBox text="No commit data" height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={filteredCommits} barCategoryGap="18%">
                  <XAxis dataKey="label" stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} width={24} />
                  <Tooltip contentStyle={tipStyle} itemStyle={{ color: "#c0c0d0" }} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} name="Commits">
                    {filteredCommits.map((_, i) => (<Cell key={i} fill="#6366f1" fillOpacity={0.3 + (i / Math.max(filteredCommits.length - 1, 1)) * 0.7} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <SectionTitle icon={Eye} text="Languages" color="#a855f7" />
            {langData.length === 0 ? <EmptyBox text="No language data" height={200} /> : (
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", background: "rgba(255,255,255,0.03)", marginBottom: 20 }}>
                  {langData.map((l, i) => (<div key={l.name} style={{ width: `${l.pct}%`, background: COLORS[i % COLORS.length] }} />))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {langData.slice(0, 6).map((l, i) => (
                    <div key={l.name} style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "inline-block" }} /><span style={{ fontSize: 13 }}>{l.name}</span></div>
                      <span style={{ fontSize: 12, fontFamily: "monospace", color: "#555570" }}>{l.pct.toFixed(1)}%</span>
                    </div>))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ───── Star History + Code Size + Contributor Growth ───── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
          {/* Star History */}
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionTitle icon={Star} text="Star History" color="#eab308" />
              <span style={{ fontSize: 11, color: "#555570", fontFamily: "monospace" }}>{summary?.stars ?? 0} total</span>
            </div>
            {traffic.filter(t => t.stars > 0).length < 2 ? <EmptyBox text="Star data builds over time" height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={traffic.filter(t => t.stars > 0).map(t => ({ ...t, label: fmt(t.date) }))}>
                  <defs>
                    <linearGradient id="gStars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eab308" stopOpacity={0.2} /><stop offset="100%" stopColor="#eab308" stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} width={28} domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip contentStyle={tipStyle} />
                  <Area type="monotone" dataKey="stars" stroke="#eab308" strokeWidth={2} fill="url(#gStars)" dot={{ r: 2, fill: "#eab308" }} name="Stars" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Code Size */}
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionTitle icon={Activity} text="Code Size" color="#a855f7" />
              <span style={{ fontSize: 11, color: "#555570", fontFamily: "monospace" }}>{summary?.size ? `${(summary.size / 1024).toFixed(1)} MB` : "—"}</span>
            </div>
            {traffic.filter(t => t.repo_size > 0).length < 2 ? <EmptyBox text="Size data builds over time" height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={traffic.filter(t => t.repo_size > 0).map(t => ({ ...t, label: fmt(t.date) }))}>
                  <defs>
                    <linearGradient id="gSize" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.2} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} width={32} />
                  <Tooltip contentStyle={tipStyle} formatter={(v: any) => `${v} KB`} />
                  <Area type="monotone" dataKey="repo_size" stroke="#a855f7" strokeWidth={2} fill="url(#gSize)" dot={{ r: 2, fill: "#a855f7" }} name="Size (KB)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Contributor Growth */}
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <SectionTitle icon={Users} text="Contributor Growth" color="#14b8a6" />
              <span style={{ fontSize: 11, color: "#555570" }}>{contributors.length} contributors</span>
            </div>
            {commits.length < 2 ? <EmptyBox text="Commit data builds over time" height={180} /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={commits.slice(-26).map(c => ({ ...c, label: fmt(c.week) }))} barCategoryGap="18%">
                  <XAxis dataKey="label" stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="transparent" tick={{ fontSize: 9, fill: "#3a3a50" }} tickLine={false} width={24} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey="total" radius={[3, 3, 0, 0]} fill="#14b8a6" fillOpacity={0.6} name="Commits/week" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ───── Contributors ───── */}
        <div id="people" style={{ scrollMarginTop: 70, background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionTitle icon={Users} text="Contributors" color="#0ea5e9" />
            <span style={{ fontSize: 11, color: "#555570" }}>{contributors.length} people</span>
          </div>
          {contributors.length === 0 ? <EmptyBox text="No contributors" height={80} /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {contributors.map((c, i) => (
                <a key={c.login} href={c.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, textDecoration: "none", color: "inherit", border: "1px solid transparent", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "#1c1c2e"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                  <img src={c.avatar} alt={c.login} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #1c1c2e" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#e0e0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.login}</p>
                    <p style={{ fontSize: 11, color: "#555570" }}>{c.commits} commits</p>
                  </div>
                </a>))}
            </div>
          )}
        </div>

        {/* ───── Issues (with filter) + PRs (with filter) ───── */}
        <div id="tracker" style={{ scrollMarginTop: 70, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <SectionTitle icon={CircleDot} text="Issues" color="#f43f5e" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
                <StateFilter active={issueState} onChange={setIssueState} options={[
                  { label: "All", value: "all" },
                  { label: "Open", value: "open", count: issues.filter(i => i.state === "open").length },
                  { label: "Closed", value: "closed", count: issues.filter(i => i.state === "closed").length },
                ]} />
                <FilterBar active={issueDays} onChange={setIssueDays} />
              </div>
            </div>
            {filteredIssues.length === 0 ? <EmptyBox text={`No ${issueState === "all" ? "" : issueState} issues`} height={80} /> : (
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredIssues.map(issue => (
                  <a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "block", padding: "12px 14px", borderRadius: 10, border: "1px solid transparent", textDecoration: "none", color: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "#1c1c2e"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 6,
                            background: issue.state === "open" ? "rgba(244,63,94,0.1)" : "rgba(139,92,246,0.1)",
                            color: issue.state === "open" ? "#fb7185" : "#a78bfa" }}>{issue.state}</span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#3a3a50" }}>#{issue.number}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#e0e0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.title}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "#555570" }}>
                          <span>{issue.author}</span><span>{fmt(issue.created_at)}</span>
                          {issue.state === "closed" && issue.closed_at && <span>closed {fmt(issue.closed_at)}</span>}
                        </div>
                      </div>
                      <ExternalLink size={14} color="#3a3a50" style={{ flexShrink: 0 }} />
                    </div>
                  </a>))}
              </div>
            )}
          </div>

          <div style={{ background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <SectionTitle icon={GitPullRequest} text="Pull Requests" color="#84cc16" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
                <StateFilter active={prState} onChange={setPrState} options={[
                  { label: "All", value: "all" },
                  { label: "Open", value: "open", count: pulls.filter(p => p.state === "open").length },
                  { label: "Merged", value: "merged", count: pulls.filter(p => p.merged_at).length },
                  { label: "Closed", value: "closed", count: pulls.filter(p => p.state === "closed" && !p.merged_at).length },
                ]} />
                <FilterBar active={prDays} onChange={setPrDays} />
              </div>
            </div>
            {filteredPulls.length === 0 ? <EmptyBox text={`No ${prState === "all" ? "" : prState} pull requests`} height={80} /> : (
              <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredPulls.map(pr => (
                  <a key={pr.number} href={pr.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "block", padding: "12px 14px", borderRadius: 10, border: "1px solid transparent", textDecoration: "none", color: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "#1c1c2e"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 6,
                            background: pr.merged_at ? "rgba(139,92,246,0.1)" : pr.draft ? "rgba(255,255,255,0.04)" : pr.state === "open" ? "rgba(132,204,22,0.1)" : "rgba(239,68,68,0.1)",
                            color: pr.merged_at ? "#a78bfa" : pr.draft ? "#555570" : pr.state === "open" ? "#a3e635" : "#f87171"
                          }}>{pr.merged_at ? "merged" : pr.draft ? "draft" : pr.state}</span>
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#3a3a50" }}>#{pr.number}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#e0e0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.title}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "#555570" }}>
                          <span>{pr.author}</span><span>{fmt(pr.created_at)}</span>
                          {pr.merged_at && <span>merged {fmt(pr.merged_at)}</span>}
                        </div>
                      </div>
                      <ExternalLink size={14} color="#3a3a50" style={{ flexShrink: 0 }} />
                    </div>
                  </a>))}
              </div>
            )}
          </div>
        </div>

        {/* ───── Releases ───── */}
        <div id="releases" style={{ scrollMarginTop: 70, background: "#111119", border: "1px solid #1c1c2e", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionTitle icon={Tag} text="Releases" color="#14b8a6" />
            <span style={{ fontSize: 11, color: "#555570" }}>{releases.length} releases</span>
          </div>
          {releases.length === 0 ? <EmptyBox text="No releases yet" height={60} /> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {(showAllReleases ? releases : releases.slice(0, 6)).map((r, i) => (
                  <a key={r.tag} href={r.url} target="_blank" rel="noopener noreferrer"
                    style={{ minWidth: 0, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.015)", border: "1px solid #1c1c2e", textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minWidth: 0 }}>
                      <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#e0e0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.tag}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#555570", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 8 }}>{r.name}</p>
                    <p style={{ fontSize: 10, color: "#3a3a50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.author} / {fmt(r.published_at)}</p>
                  </a>))}
              </div>
              {releases.length > 6 && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                  <button onClick={() => setShowAllReleases(v => !v)}
                    style={{
                      padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      border: "1px solid #1c1c2e", transition: "all 0.15s",
                      background: "rgba(20,184,166,0.1)", color: "#14b8a6",
                    }}>
                    {showAllReleases ? "Show less" : `View all ${releases.length} releases`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#22223a", padding: "16px 0" }}>GitHub Analytics Dashboard</p>
      </div>
    </div>
  );
}
