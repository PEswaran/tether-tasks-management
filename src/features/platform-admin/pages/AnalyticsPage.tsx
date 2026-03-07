import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { BarChart3, Globe2, RefreshCw, Users } from "lucide-react";
import { dataClient } from "../../../libs/data-client";

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
};

export default function AnalyticsPage() {
    const client = dataClient();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [data, setData] = useState<AnalyticsResponse | null>(null);
    const visibleLocations = (data?.locations || []).filter(
        (item) => item.country && item.country.trim().toLowerCase() !== "(not set)"
    );

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await client.mutations.getPlatformAnalytics({
                startDate: "30daysAgo",
                endDate: "today",
            });
            const raw = (res as any)?.data?.getPlatformAnalytics ?? (res as any)?.data ?? null;
            const payload: AnalyticsResponse | null =
                typeof raw === "string"
                    ? (JSON.parse(raw) as AnalyticsResponse)
                    : ((raw as AnalyticsResponse | null) ?? null);
            if (!payload?.success) {
                setError(payload?.message || "Failed to load analytics.");
                setData(payload);
            } else {
                setData(payload);
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load analytics.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="dash">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">
                        <BarChart3 size={24} />
                        Website Analytics
                    </h1>
                    <p className="dash-sub">
                        Google Analytics 4 data for the last 30 days
                    </p>
                </div>
                <button className="btn-ghost" onClick={load} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {error ? (
                <div className="dash-panel" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fff7f7" }}>
                    {error}
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
                    <div className="kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
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
