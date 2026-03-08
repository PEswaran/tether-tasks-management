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
    {
        id: "TRIAL",
        name: "Trial",
        price: "Free for 14 days",
        features: ["3 organizations", "5 workspaces", "25 members", "Unlimited tasks"],
        color: "#f59e0b",
        subtitle: "14-day trial",
    },
];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
    });
}

function computeTrialEnd(startDate: string) {
    const end = new Date(startDate);
    end.setDate(end.getDate() + 14);
    return end.toISOString().split("T")[0];
}

export default function CreateTenantModal({ onClose, onCreated }: Props) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [step, setStep] = useState(1);

    // Step 1 fields
    const [companyName, setCompanyName] = useState("");
    const [adminFirstName, setAdminFirstName] = useState("");
    const [adminLastName, setAdminLastName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [selectedPlan, setSelectedPlan] = useState("STARTER");
    const [trialStartDate, setTrialStartDate] = useState(
        new Date().toISOString().split("T")[0]
    );

    // Step 2 fields
    const [agreementNotes, setAgreementNotes] = useState("");

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => onCreated(), 2000);
        return () => clearTimeout(timer);
    }, [success]);

    function goToStep2() {
        if (!companyName.trim() || !adminEmail.trim()) {
            alert({ title: "Missing Fields", message: "Company name and admin email are required.", variant: "warning" });
            return;
        }
        setStep(2);
    }

    async function createCompany() {
        try {
            setLoading(true);

            const res = await client.mutations.createTenantAdmin({
                companyName: companyName.trim(),
                adminEmail: adminEmail.trim().toLowerCase(),
                adminFirstName: adminFirstName.trim() || undefined,
                adminLastName: adminLastName.trim() || undefined,
                plan: selectedPlan,
                trialStartDate: selectedPlan === "TRIAL" ? trialStartDate : undefined,
                agreementNotes: agreementNotes.trim() || undefined,
            });

            if (res.errors?.length) {
                await alert({ title: "Error", message: res.errors.map((e: any) => e.message).join(", "), variant: "danger" });
                return;
            }

            if (!res.data?.success) {
                await alert({ title: "Error", message: res.data?.message || "Failed to create tenant", variant: "danger" });
                return;
            }

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            await alert({ title: "Error", message: err.message, variant: "danger" });
        } finally {
            setLoading(false);
        }
    }

    const trialEndDate = selectedPlan === "TRIAL" ? computeTrialEnd(trialStartDate) : "";
    const planInfo = PLANS.find(p => p.id === selectedPlan);

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 600 }}>

                <div className="modal-header">
                    <h2>Create Company</h2>
                    <div className="modal-sub">
                        {step === 1
                            ? "Step 1 of 2 \u2014 Company & Admin Info"
                            : "Step 2 of 2 \u2014 Review & Agreement"}
                    </div>
                </div>

                {success ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12, color: "#16a34a" }}>&#10003;</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#16a34a" }}>
                            Company created!
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                            {companyName} &mdash; Invite sent to {adminEmail}
                        </div>
                    </div>
                ) : step === 1 ? (
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

                            {/* ADMIN NAME */}
                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="tenant-admin-first">Admin First Name</label>
                                    <input
                                        id="tenant-admin-first"
                                        name="tenant_admin_first"
                                        value={adminFirstName}
                                        onChange={(e) => setAdminFirstName(e.target.value)}
                                        placeholder="John"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="tenant-admin-last">Admin Last Name</label>
                                    <input
                                        id="tenant-admin-last"
                                        name="tenant_admin_last"
                                        value={adminLastName}
                                        onChange={(e) => setAdminLastName(e.target.value)}
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

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
                            <div id="tenant-plan" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                                {PLANS.map(plan => {
                                    const isActive = selectedPlan === plan.id;
                                    return (
                                        <div
                                            key={plan.id}
                                            onClick={() => setSelectedPlan(plan.id)}
                                            style={{
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
                                                {"subtitle" in plan && (
                                                    <span style={{
                                                        fontSize: 11,
                                                        fontWeight: 500,
                                                        marginLeft: 6,
                                                        color: plan.color,
                                                    }}>
                                                        {plan.subtitle}
                                                    </span>
                                                )}
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

                            {/* TRIAL DATE PICKER */}
                            {selectedPlan === "TRIAL" && (
                                <div style={{
                                    marginTop: 12,
                                    padding: "14px 16px",
                                    background: "#fffbeb",
                                    border: "1px solid #fde68a",
                                    borderRadius: 8,
                                }}>
                                    <label htmlFor="trial-start-date" style={{ marginBottom: 4, display: "block", fontWeight: 600, fontSize: 13, color: "#92400e" }}>
                                        Trial Start Date
                                    </label>
                                    <input
                                        id="trial-start-date"
                                        name="trial_start_date"
                                        type="date"
                                        value={trialStartDate}
                                        onChange={(e) => setTrialStartDate(e.target.value)}
                                        style={{ marginBottom: 8 }}
                                    />
                                    <div style={{ fontSize: 13, color: "#92400e" }}>
                                        Expires: <strong>{formatDate(trialEndDate)}</strong> (14 days)
                                    </div>
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button className="btn" onClick={goToStep2}>
                                Next &rarr;
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* STEP 2 — Review & Agreement */}
                        <div className="modal-form">

                            {/* Summary card */}
                            <div style={{
                                padding: "16px 20px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 10,
                            }}>
                                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>
                                    Account Summary
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px", fontSize: 14 }}>
                                    <span style={{ color: "#64748b" }}>Company</span>
                                    <span style={{ fontWeight: 500 }}>{companyName}</span>

                                    <span style={{ color: "#64748b" }}>Admin</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {adminFirstName || adminLastName
                                            ? `${adminFirstName} ${adminLastName}`.trim()
                                            : "\u2014"}
                                    </span>

                                    <span style={{ color: "#64748b" }}>Email</span>
                                    <span style={{ fontWeight: 500 }}>{adminEmail}</span>

                                    <span style={{ color: "#64748b" }}>Plan</span>
                                    <span>
                                        <span style={{
                                            background: planInfo ? `${planInfo.color}18` : "#f1f5f9",
                                            color: planInfo?.color || "#64748b",
                                            fontSize: 12,
                                            padding: "2px 10px",
                                            borderRadius: 20,
                                            fontWeight: 600,
                                        }}>
                                            {planInfo?.name || selectedPlan}
                                        </span>
                                    </span>

                                    {selectedPlan === "TRIAL" && (
                                        <>
                                            <span style={{ color: "#64748b" }}>Trial Period</span>
                                            <span style={{ fontWeight: 500, color: "#f59e0b" }}>
                                                {formatDate(trialStartDate)} &rarr; {formatDate(trialEndDate)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Custom Notes */}
                            <label htmlFor="agreement-notes" style={{ marginTop: 16 }}>
                                Custom Notes <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
                            </label>
                            <textarea
                                id="agreement-notes"
                                name="agreement_notes"
                                value={agreementNotes}
                                onChange={(e) => setAgreementNotes(e.target.value)}
                                placeholder="Add any custom terms, conditions, or notes for this account..."
                                rows={3}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    border: "1px solid #e2e8f0",
                                    fontSize: 14,
                                    resize: "vertical",
                                    fontFamily: "inherit",
                                }}
                            />

                            {/* Terms acknowledgment */}
                            <div style={{
                                marginTop: 12,
                                padding: "12px 16px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: 8,
                                fontSize: 13,
                                color: "#166534",
                            }}>
                                The admin will receive a temporary password via email and must change it on first login.
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={() => setStep(1)} disabled={loading}>
                                &larr; Back
                            </button>
                            <button className="btn" onClick={createCompany} disabled={loading}>
                                {loading ? "Creating..." : "Create & Send Invite"}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
