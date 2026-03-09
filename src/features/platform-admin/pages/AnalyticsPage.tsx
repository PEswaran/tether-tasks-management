import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { BarChart3, Globe2, RefreshCw, Users } from "lucide-react";
import { dataClient } from "../../../libs/data-client";

const RANGE_OPTIONS = [
    { label: "Last 7 days", value: "7daysAgo" },
    { label: "Last 30 days", value: "30daysAgo" },
    { label: "Last 90 days", value: "90daysAgo" },
] as const;

type AnalyticsResponse = {
    success: boolean;
    message: string | null;
    range: { startDate: string; endDate: string } | null;
    metrics: {
        activeUsers: number;
        newUsers: number;
        sessions: number;
    } | null;
    locations: Array<{
        country: string;
        visitors: number;
    }>;
    fetchedAt?: string;
    cached?: boolean;
};

function normalizeAnalyticsPayload(value: unknown): AnalyticsResponse | null {
    if (!value) return null;
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as AnalyticsResponse;
        } catch {
            return null;
        }
    }
    if (typeof value === "object") {
        return value as AnalyticsResponse;
    }
    return null;
}

export default function AnalyticsPage() {
    const client = dataClient();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [errorDetails, setErrorDetails] = useState("");
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const [startDate, setStartDate] = useState<(typeof RANGE_OPTIONS)[number]["value"]>("30daysAgo");
    const endDate = "today";
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const visibleLocations = (data?.locations || []).filter(
        (item) => item.country && item.country.trim().toLowerCase() !== "(not set)"
    );

    const load = async () => {
        setLoading(true);
        setError("");
        setErrorDetails("");
        try {
            const res = await client.mutations.getPlatformAnalytics({
                startDate,
                endDate,
            });
            const raw = (res as any)?.data?.getPlatformAnalytics ?? (res as any)?.data ?? null;
            const payload = normalizeAnalyticsPayload(raw);

            if (!payload?.success) {
                setError(payload?.message || "Failed to load analytics.");
                setErrorDetails(typeof raw === "string" ? raw : JSON.stringify(raw || {}, null, 2));
                setData(payload);
            } else {
                setData(payload);
                setLastUpdated(payload.fetchedAt || new Date().toISOString());
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load analytics.");
            setErrorDetails(JSON.stringify(err, null, 2));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [startDate, endDate]);

    return (
        <div className="dash">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">
                        <BarChart3 size={24} />
                        Website Analytics
                    </h1>
                    <p className="dash-sub">
                        Google Analytics 4 traffic and geographic audience metrics
                    </p>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                        className="workspace-page-org-select"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value as (typeof RANGE_OPTIONS)[number]["value"])}
                        disabled={loading}
                    >
                        {RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <button className="btn-ghost" onClick={load} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="dash-panel" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ color: "#475569", fontSize: 13 }}>
                        Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Not loaded yet"}
                    </span>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                        Source: GA4 ({startDate} to {endDate}) {data?.cached ? "• cached" : ""}
                    </span>
                </div>
            </div>

            {error ? (
                <div className="dash-panel" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fff7f7", marginBottom: 12 }}>
                    <div style={{ marginBottom: 8, fontWeight: 600 }}>{error}</div>
                    {errorDetails ? (
                        <details>
                            <summary style={{ cursor: "pointer", color: "#7f1d1d" }}>Show error details</summary>
                            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8, fontSize: 12, color: "#7f1d1d" }}>{errorDetails}</pre>
                        </details>
                    ) : null}
                </div>
            ) : null}

            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                        <Users size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Visitors</span>
                        <span className="kpi-value">
                            <CountUp end={data?.metrics?.activeUsers || 0} duration={0.8} />
                        </span>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
                        <BarChart3 size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Sessions</span>
                        <span className="kpi-value">
                            <CountUp end={data?.metrics?.sessions || 0} duration={0.8} />
                        </span>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>
                        <Globe2 size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">New Visitors</span>
                        <span className="kpi-value">
                            <CountUp end={data?.metrics?.newUsers || 0} duration={0.8} />
                        </span>
                    </div>
                </div>
            </div>

            <div className="dash-panel">
                <h3 className="panel-title">Top Locations</h3>
                {loading ? (
                    <div className="empty-chart">Loading analytics...</div>
                ) : visibleLocations.length === 0 ? (
                    <div className="empty-chart">No location data returned</div>
                ) : (
                    <div className="status-list">
                        {visibleLocations.map((item) => (
                            <div key={item.country} className="status-row">
                                <div className="status-left">
                                    <Globe2 size={16} color="#64748b" />
                                    <span>{item.country}</span>
                                </div>
                                <span className="status-count">{item.visitors}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
