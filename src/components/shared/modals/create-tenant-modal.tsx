import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useConfirm } from "../../../shared-components/confirm-context";

type Props = {
    onClose: () => void;
    onCreated: () => void;
};

const PLANS = [
    {
        id: "STARTER",
        name: "Starter",
        price: "Free",
        features: ["1 organization", "1 workspace", "5 members", "50 tasks"],
        color: "#64748b",
    },
    {
        id: "PROFESSIONAL",
        name: "Professional",
        price: "$29/mo",
        features: ["3 organizations", "5 workspaces", "25 members", "Unlimited tasks"],
        color: "#3b82f6",
    },
    {
        id: "ENTERPRISE",
        name: "Enterprise",
        price: "$99/mo",
        features: ["Unlimited organizations", "Unlimited workspaces", "Unlimited members", "Priority support"],
        color: "#7c3aed",
    },
];

export default function CreateTenantModal({ onClose, onCreated }: Props) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [companyName, setCompanyName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [selectedPlan, setSelectedPlan] = useState("STARTER");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => onCreated(), 2000);
        return () => clearTimeout(timer);
    }, [success]);

    async function createCompany() {
        if (!companyName.trim() || !adminEmail.trim()) {
            await alert({ title: "Missing Fields", message: "Company name and admin email required", variant: "warning" });
            return;
        }

        try {
            setLoading(true);

            const res = await client.mutations.createTenantAdmin({
                companyName: companyName.trim(),
                adminEmail: adminEmail.trim().toLowerCase(),
            });

            if (res.errors?.length) {
                await alert({ title: "Error", message: res.errors.map((e: any) => e.message).join(", "), variant: "danger" });
                return;
            }

            if (!res.data?.success) {
                await alert({ title: "Error", message: res.data?.message || "Failed to create tenant", variant: "danger" });
                return;
            }

            // persist the selected plan
            if (res.data.tenantId && selectedPlan !== "STARTER") {
                await client.models.Tenant.update({
                    id: res.data.tenantId,
                    plan: selectedPlan,
                });
            }

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            await alert({ title: "Error", message: err.message, variant: "danger" });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">

                <div className="modal-header">
                    <h2>Create Company</h2>
                    <div className="modal-sub">
                        Set up a new tenant with an admin account
                    </div>
                </div>

                {success ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12, color: "#16a34a" }}>&#10003;</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#16a34a" }}>
                            Company created!
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                            {companyName}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="modal-form">

                            {/* COMPANY NAME */}
                            <label htmlFor="tenant-company-name">Company Name</label>
                            <input
                                id="tenant-company-name"
                                name="tenant_company_name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Acme Inc"
                            />

                            {/* ADMIN EMAIL */}
                            <label htmlFor="tenant-admin-email">Admin Email</label>
                            <input
                                id="tenant-admin-email"
                                name="tenant_admin_email"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="admin@company.com"
                            />

                            {/* PLAN SELECTOR */}
                            <label htmlFor="tenant-plan">Subscription Plan</label>
                            <div id="tenant-plan" style={{ display: "flex", gap: 12, marginTop: 4 }}>
                                {PLANS.map(plan => {
                                    const isActive = selectedPlan === plan.id;
                                    return (
                                        <div
                                            key={plan.id}
                                            onClick={() => setSelectedPlan(plan.id)}
                                            style={{
                                                flex: 1,
                                                padding: "16px 14px",
                                                borderRadius: 10,
                                                border: isActive
                                                    ? `2px solid ${plan.color}`
                                                    : "2px solid #e5e7eb",
                                                background: isActive ? `${plan.color}08` : "#fff",
                                                cursor: "pointer",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            <div style={{
                                                fontWeight: 600,
                                                fontSize: 14,
                                                color: isActive ? plan.color : "#1e293b",
                                                marginBottom: 2,
                                            }}>
                                                {plan.name}
                                            </div>
                                            <div style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: "#1e293b",
                                                marginBottom: 8,
                                            }}>
                                                {plan.price}
                                            </div>
                                            <ul style={{
                                                listStyle: "none",
                                                padding: 0,
                                                margin: 0,
                                                fontSize: 12,
                                                color: "#64748b",
                                            }}>
                                                {plan.features.map(f => (
                                                    <li key={f} style={{ marginBottom: 2 }}>
                                                        &#10003; {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={onClose} disabled={loading}>
                                Cancel
                            </button>
                            <button className="btn" onClick={createCompany} disabled={loading}>
                                {loading ? "Creating..." : "Create Company"}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
