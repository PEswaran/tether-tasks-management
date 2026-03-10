import { useEffect, useState } from "react";
import { FileText, Download, Search } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import { getUrl } from "aws-amplify/storage";
import CountUp from "react-countup";

interface AgreementRow {
    id: string;
    companyName: string;
    adminName: string;
    adminEmail: string;
    type: "Pilot" | "T&C";
    plan: string;
    generatedAt: string;
    s3Key: string;
}

export default function AgreementsPage() {
    const client = dataClient();

    const [agreements, setAgreements] = useState<AgreementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        try {
            const [pilotRes, tenantRes] = await Promise.all([
                client.models.PilotAgreement.list(),
                client.models.Tenant.list(),
            ]);

            const pilotRows: AgreementRow[] = pilotRes.data.map((a: any) => ({
                id: `pilot-${a.id}`,
                companyName: a.companyName || "—",
                adminName: a.adminName || "—",
                adminEmail: a.adminEmail || "—",
                type: "Pilot" as const,
                plan: "PILOT",
                generatedAt: a.generatedAt || a.createdAt || "",
                s3Key: a.s3Key,
            }));

            const tcRows: AgreementRow[] = tenantRes.data
                .filter((t: any) => t.agreementS3Key)
                .map((t: any) => ({
                    id: `tc-${t.id}`,
                    companyName: t.companyName || "—",
                    adminName: t.adminName || "—",
                    adminEmail: "",
                    type: "T&C" as const,
                    plan: t.plan || "—",
                    generatedAt: t.createdAt || "",
                    s3Key: t.agreementS3Key!,
                }));

            const merged = [...pilotRows, ...tcRows].sort(
                (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
            );

            setAgreements(merged);
        } catch (err) {
            console.error("Error loading agreements:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDownload(row: AgreementRow) {
        setDownloading(row.id);
        try {
            const result = await getUrl({ path: row.s3Key });
            window.open(result.url.toString(), "_blank");
        } catch (err) {
            console.error("Error getting agreement URL:", err);
        } finally {
            setDownloading(null);
        }
    }

    const filtered = agreements.filter(a => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            a.companyName.toLowerCase().includes(q) ||
            a.adminEmail.toLowerCase().includes(q)
        );
    });

    const pilotCount = agreements.filter(a => a.type === "Pilot").length;
    const tcCount = agreements.filter(a => a.type === "T&C").length;

    if (loading) {
        return (
            <div className="dash">
                <div className="dash-skeleton">
                    <div className="skel-row">
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                        <div className="skel-card shimmer" />
                    </div>
                    <div className="skel-row">
                        <div className="skel-wide shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={22} />
                        Agreements
                    </h1>
                    <p className="page-sub">
                        {agreements.length} agreement{agreements.length !== 1 ? "s" : ""} across the platform
                    </p>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="kpi-grid" style={{ marginBottom: 24 }}>
                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#e8f0fa", color: "#1e3a5f" }}>
                        <FileText size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Total Agreements</span>
                        <span className="kpi-value">
                            <CountUp end={agreements.length} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
                        <FileText size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">Pilot Agreements</span>
                        <span className="kpi-value">
                            <CountUp end={pilotCount} duration={0.8} />
                        </span>
                    </div>
                </div>

                <div className="kpi-card" style={{ cursor: "default" }}>
                    <div className="kpi-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
                        <FileText size={20} />
                    </div>
                    <div className="kpi-body">
                        <span className="kpi-label">T&C Agreements</span>
                        <span className="kpi-value">
                            <CountUp end={tcCount} duration={0.8} />
                        </span>
                    </div>
                </div>
            </div>

            {/* SEARCH */}
            <div style={{ marginBottom: 16, position: "relative", maxWidth: 360 }}>
                <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }} />
                <input
                    type="text"
                    placeholder="Search by company or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 13,
                        outline: "none",
                    }}
                />
            </div>

            {/* TABLE */}
            {filtered.length === 0 ? (
                <div style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "#94a3b8",
                }}>
                    <FileText size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <div style={{ fontSize: 16, fontWeight: 500 }}>
                        {search.trim() ? "No matching agreements" : "No agreements yet"}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                        {search.trim()
                            ? "Try a different search term"
                            : "Agreements will appear here once generated"}
                    </div>
                </div>
            ) : (
                <table className="table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Admin</th>
                            <th>Type</th>
                            <th>Plan</th>
                            <th>Generated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(row => (
                            <tr key={row.id}>
                                <td style={{ fontWeight: 500 }}>{row.companyName}</td>
                                <td>
                                    <div>
                                        <div style={{ fontWeight: 500, fontSize: 13 }}>{row.adminName}</div>
                                        {row.adminEmail && (
                                            <div style={{ fontSize: 12, color: "#64748b" }}>{row.adminEmail}</div>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <span style={{
                                        background: row.type === "Pilot" ? "#f3e8ff" : "#e0f2fe",
                                        color: row.type === "Pilot" ? "#7c3aed" : "#0284c7",
                                        fontSize: 12,
                                        padding: "3px 10px",
                                        borderRadius: 20,
                                        fontWeight: 600,
                                    }}>
                                        {row.type}
                                    </span>
                                </td>
                                <td style={{ color: "#64748b" }}>{row.plan}</td>
                                <td style={{ color: "#64748b" }}>
                                    {row.generatedAt
                                        ? new Date(row.generatedAt).toLocaleDateString()
                                        : "—"}
                                </td>
                                <td>
                                    <button
                                        className="btn secondary"
                                        style={{ fontSize: 12, padding: "4px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}
                                        onClick={() => handleDownload(row)}
                                        disabled={downloading === row.id}
                                    >
                                        <Download size={14} />
                                        {downloading === row.id ? "Opening..." : "Download"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
