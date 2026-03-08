import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { dataClient } from "../../../libs/data-client";
import CreateTenantModal from "../../../components/shared/modals/create-tenant-modal";

function getPlanLabel(plan: string | null | undefined) {
    switch (plan) {
        case "PROFESSIONAL": return "Professional";
        case "ENTERPRISE": return "Enterprise";
        case "TRIAL": return "Trial";
        default: return "Starter";
    }
}

function getPlanColor(plan: string | null | undefined) {
    switch (plan) {
        case "PROFESSIONAL": return { bg: "#eff6ff", color: "#3b82f6" };
        case "ENTERPRISE": return { bg: "#f5f3ff", color: "#7c3aed" };
        case "TRIAL": return { bg: "#fffbeb", color: "#f59e0b" };
        default: return { bg: "#f1f5f9", color: "#64748b" };
    }
}

function getTrialDaysLeft(trialEndDate: string | null | undefined): string | null {
    if (!trialEndDate) return null;
    const now = new Date();
    const end = new Date(trialEndDate);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Expired";
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} left`;
}

export default function TenantsPage() {
    const client = dataClient();
    const navigate = useNavigate();

    const [tenants, setTenants] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        const res = await client.models.Tenant.list();
        setTenants(res.data);
    }

    return (
        <div>

            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Building2 size={22} />
                        Companies
                    </h1>
                    <p className="page-sub">
                        {tenants.length} compan{tenants.length !== 1 ? "ies" : "y"} on the platform
                    </p>
                </div>
                <button className="btn" onClick={() => setShowCreate(true)}>
                    + Create Company
                </button>
            </div>

            {showCreate && (
                <CreateTenantModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
                    }}
                />
            )}

            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {tenants.map(t => {
                        const planStyle = getPlanColor(t.plan);
                        return (
                            <tr
                                key={t.id}
                                style={{ cursor: "pointer" }}
                                onClick={() => navigate(`/super/tenant/${t.id}`)}
                            >
                                <td style={{ fontWeight: 500 }}>{t.companyName}</td>
                                <td>
                                    <span style={{
                                        background: planStyle.bg,
                                        color: planStyle.color,
                                        fontSize: 12,
                                        padding: "3px 10px",
                                        borderRadius: 20,
                                        fontWeight: 600,
                                    }}>
                                        {getPlanLabel(t.plan)}
                                    </span>
                                    {t.plan === "TRIAL" && (
                                        <span style={{
                                            fontSize: 11,
                                            color: getTrialDaysLeft(t.trialEndDate) === "Expired" ? "#dc2626" : "#f59e0b",
                                            marginLeft: 6,
                                            fontWeight: 500,
                                        }}>
                                            ({getTrialDaysLeft(t.trialEndDate) || "No end date"})
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <span style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: t.status === "SUSPENDED" ? "#dc2626" : "#16a34a",
                                    }}>
                                        {t.status === "SUSPENDED" ? "Suspended" : "Active"}
                                    </span>
                                </td>
                                <td style={{ color: "#64748b" }}>
                                    {new Date(t.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
