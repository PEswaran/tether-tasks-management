import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useConfirm } from "../../../shared-components/confirm-context";

type Props = {
    onClose: () => void;
    onCreated: () => void;
};

const DURATION_OPTIONS = [
    { value: 14, label: "14 days" },
    { value: 30, label: "30 days" },
    { value: 60, label: "60 days" },
    { value: 90, label: "90 days" },
];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
    });
}

function computeEndDate(startDate: string, days: number) {
    const end = new Date(startDate);
    end.setDate(end.getDate() + days);
    return end.toISOString().split("T")[0];
}

export default function CreatePilotModal({ onClose, onCreated }: Props) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [step, setStep] = useState(1);

    // Step 1
    const [companyName, setCompanyName] = useState("");
    const [adminFirstName, setAdminFirstName] = useState("");
    const [adminLastName, setAdminLastName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [pilotDurationDays, setPilotDurationDays] = useState(30);
    const [pilotStartDate, setPilotStartDate] = useState(
        new Date().toISOString().split("T")[0]
    );

    // Step 2
    const [agreementNotes, setAgreementNotes] = useState("");
    const [pilotNotes, setPilotNotes] = useState("");
    const [orgName, setOrgName] = useState("");
    const [workspaceName, setWorkspaceName] = useState("");
    const [boardName, setBoardName] = useState("");

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => onCreated(), 2000);
        return () => clearTimeout(timer);
    }, [success]);

    const endDate = computeEndDate(pilotStartDate, pilotDurationDays);

    function goToStep2() {
        if (!companyName.trim() || !adminEmail.trim()) {
            alert({ title: "Missing Fields", message: "Company name and admin email are required.", variant: "warning" });
            return;
        }
        setStep(2);
    }

    function goToStep3() {
        setStep(3);
    }

    async function createPilot() {
        try {
            setLoading(true);

            const res = await client.mutations.createPilot({
                companyName: companyName.trim(),
                adminEmail: adminEmail.trim().toLowerCase(),
                adminFirstName: adminFirstName.trim() || undefined,
                adminLastName: adminLastName.trim() || undefined,
                pilotDurationDays,
                pilotStartDate,
                pilotNotes: pilotNotes.trim() || undefined,
                agreementNotes: agreementNotes.trim() || undefined,
                orgName: orgName.trim() || undefined,
                workspaceName: workspaceName.trim() || undefined,
                boardName: boardName.trim() || undefined,
            });

            if (res.errors?.length) {
                await alert({ title: "Error", message: res.errors.map((e: any) => e.message).join(", "), variant: "danger" });
                return;
            }

            if (!res.data?.success) {
                await alert({ title: "Error", message: res.data?.message || "Failed to create pilot", variant: "danger" });
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

    const stepLabels = [
        "Step 1 of 3 — Company & Admin Info",
        "Step 2 of 3 — Agreement & Notes",
        "Step 3 of 3 — Review & Confirm",
    ];

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ maxWidth: 600 }}>

                <div className="modal-header">
                    <h2>Create Pilot Program</h2>
                    <div className="modal-sub">{stepLabels[step - 1]}</div>
                </div>

                {success ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ fontSize: 40, marginBottom: 12, color: "#16a34a" }}>&#10003;</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#16a34a" }}>
                            Pilot created!
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
                            Workspace provisioned and agreement emailed to {adminEmail}
                        </div>
                    </div>
                ) : step === 1 ? (
                    <>
                        <div className="modal-form">

                            <label htmlFor="pilot-company-name">Company Name</label>
                            <input
                                id="pilot-company-name"
                                name="pilot_company_name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="Acme Inc"
                            />

                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="pilot-admin-first">Admin First Name</label>
                                    <input
                                        id="pilot-admin-first"
                                        name="pilot_admin_first"
                                        value={adminFirstName}
                                        onChange={(e) => setAdminFirstName(e.target.value)}
                                        placeholder="John"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="pilot-admin-last">Admin Last Name</label>
                                    <input
                                        id="pilot-admin-last"
                                        name="pilot_admin_last"
                                        value={adminLastName}
                                        onChange={(e) => setAdminLastName(e.target.value)}
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            <label htmlFor="pilot-admin-email">Admin Email</label>
                            <input
                                id="pilot-admin-email"
                                name="pilot_admin_email"
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="admin@company.com"
                            />

                            <label htmlFor="pilot-duration">Pilot Duration</label>
                            <select
                                id="pilot-duration"
                                name="pilot_duration"
                                value={pilotDurationDays}
                                onChange={(e) => setPilotDurationDays(Number(e.target.value))}
                                style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    border: "1px solid #e2e8f0",
                                    fontSize: 14,
                                    fontFamily: "inherit",
                                    background: "#fff",
                                }}
                            >
                                {DURATION_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>

                            <label htmlFor="pilot-start-date">Start Date</label>
                            <input
                                id="pilot-start-date"
                                name="pilot_start_date"
                                type="date"
                                value={pilotStartDate}
                                onChange={(e) => setPilotStartDate(e.target.value)}
                            />

                            <div style={{
                                marginTop: 8,
                                padding: "12px 16px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: 8,
                                fontSize: 13,
                                color: "#166534",
                            }}>
                                Pilot ends: <strong>{formatDate(endDate)}</strong> ({pilotDurationDays} days)
                            </div>

                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={onClose}>Cancel</button>
                            <button className="btn" onClick={goToStep2}>Next &rarr;</button>
                        </div>
                    </>
                ) : step === 2 ? (
                    <>
                        <div className="modal-form">

                            <label htmlFor="pilot-agreement-notes">
                                Agreement Notes <span style={{ fontWeight: 400, color: "#94a3b8" }}>(shared with participant)</span>
                            </label>
                            <textarea
                                id="pilot-agreement-notes"
                                name="pilot_agreement_notes"
                                value={agreementNotes}
                                onChange={(e) => setAgreementNotes(e.target.value)}
                                placeholder="Any terms, conditions, or notes included in the agreement PDF..."
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

                            <label htmlFor="pilot-internal-notes">
                                Internal Notes <span style={{ fontWeight: 400, color: "#94a3b8" }}>(admin-only)</span>
                            </label>
                            <textarea
                                id="pilot-internal-notes"
                                name="pilot_internal_notes"
                                value={pilotNotes}
                                onChange={(e) => setPilotNotes(e.target.value)}
                                placeholder="Internal notes about this pilot (not shared with the participant)..."
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

                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="pilot-org-name">
                                        Organization Name <span style={{ fontWeight: 400, color: "#94a3b8" }}>(default: company name)</span>
                                    </label>
                                    <input
                                        id="pilot-org-name"
                                        name="pilot_org_name"
                                        value={orgName}
                                        onChange={(e) => setOrgName(e.target.value)}
                                        placeholder={companyName || "Company Name"}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="pilot-ws-name">Workspace Name</label>
                                    <input
                                        id="pilot-ws-name"
                                        name="pilot_ws_name"
                                        value={workspaceName}
                                        onChange={(e) => setWorkspaceName(e.target.value)}
                                        placeholder="Main Workspace"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label htmlFor="pilot-board-name">Board Name</label>
                                    <input
                                        id="pilot-board-name"
                                        name="pilot_board_name"
                                        value={boardName}
                                        onChange={(e) => setBoardName(e.target.value)}
                                        placeholder="Task Board"
                                    />
                                </div>
                            </div>

                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={() => setStep(1)}>
                                &larr; Back
                            </button>
                            <button className="btn" onClick={goToStep3}>Next &rarr;</button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* STEP 3 — Review & Confirm */}
                        <div className="modal-form">

                            <div style={{
                                padding: "16px 20px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 10,
                            }}>
                                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>
                                    Pilot Summary
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "8px 12px", fontSize: 14 }}>
                                    <span style={{ color: "#64748b" }}>Company</span>
                                    <span style={{ fontWeight: 500 }}>{companyName}</span>

                                    <span style={{ color: "#64748b" }}>Admin</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {adminFirstName || adminLastName
                                            ? `${adminFirstName} ${adminLastName}`.trim()
                                            : "—"}
                                    </span>

                                    <span style={{ color: "#64748b" }}>Email</span>
                                    <span style={{ fontWeight: 500 }}>{adminEmail}</span>

                                    <span style={{ color: "#64748b" }}>Plan</span>
                                    <span>
                                        <span style={{
                                            background: "#dbeafe",
                                            color: "#1d4ed8",
                                            fontSize: 12,
                                            padding: "2px 10px",
                                            borderRadius: 20,
                                            fontWeight: 600,
                                        }}>
                                            PILOT
                                        </span>
                                    </span>

                                    <span style={{ color: "#64748b" }}>Duration</span>
                                    <span style={{ fontWeight: 500 }}>{pilotDurationDays} days</span>

                                    <span style={{ color: "#64748b" }}>Period</span>
                                    <span style={{ fontWeight: 500, color: "#1d4ed8" }}>
                                        {formatDate(pilotStartDate)} &rarr; {formatDate(endDate)}
                                    </span>

                                    <span style={{ color: "#64748b" }}>Organization</span>
                                    <span style={{ fontWeight: 500 }}>{orgName || companyName}</span>

                                    <span style={{ color: "#64748b" }}>Workspace</span>
                                    <span style={{ fontWeight: 500 }}>{workspaceName || "Main Workspace"}</span>

                                    <span style={{ color: "#64748b" }}>Board</span>
                                    <span style={{ fontWeight: 500 }}>{boardName || "Task Board"}</span>
                                </div>
                            </div>

                            {agreementNotes && (
                                <div style={{
                                    marginTop: 12,
                                    padding: "12px 16px",
                                    background: "#fffbeb",
                                    border: "1px solid #fde68a",
                                    borderRadius: 8,
                                    fontSize: 13,
                                }}>
                                    <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Agreement Notes</div>
                                    <div style={{ color: "#78350f" }}>{agreementNotes}</div>
                                </div>
                            )}

                            {pilotNotes && (
                                <div style={{
                                    marginTop: 8,
                                    padding: "12px 16px",
                                    background: "#f1f5f9",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 8,
                                    fontSize: 13,
                                }}>
                                    <div style={{ fontWeight: 600, color: "#475569", marginBottom: 4 }}>Internal Notes</div>
                                    <div style={{ color: "#64748b" }}>{pilotNotes}</div>
                                </div>
                            )}

                            <div style={{
                                marginTop: 12,
                                padding: "12px 16px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: 8,
                                fontSize: 13,
                                color: "#166534",
                            }}>
                                This will create a fully provisioned workspace with organization, workspace, and board.
                                The admin will receive a temporary password and a pilot confirmation email.
                                A PDF agreement will be generated and stored.
                            </div>

                        </div>

                        <div className="modal-footer">
                            <button className="btn secondary" onClick={() => setStep(2)} disabled={loading}>
                                &larr; Back
                            </button>
                            <button className="btn" onClick={createPilot} disabled={loading}>
                                {loading ? "Creating..." : "Create Pilot & Send Agreement"}
                            </button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
