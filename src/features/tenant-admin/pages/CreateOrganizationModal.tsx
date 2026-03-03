import { useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { useConfirm } from "../../../shared-components/confirm-context";
import { getPlanLimits, formatPlanLimitMessage } from "../../../libs/planLimits";
import { logAudit } from "../../../libs/audit";

function ensureString(value: string | null | undefined, label: string): string {
    if (!value) {
        throw new Error(`${label} is required`);
    }
    return value;
}

type InviteResult = { email: string; role: string; success: boolean; message: string };

const BOARD_TYPES = [
    { value: "KANBAN", label: "Kanban Board", desc: "Visual columns for workflow stages (To Do, In Progress, Done)" },
    { value: "TIMELINE", label: "Timeline", desc: "Schedule tasks with due dates and milestones" },
    { value: "PROCESS", label: "Process Tracker", desc: "Step-by-step workflow for repeatable processes" },
    { value: "LIST", label: "Simple List", desc: "Flat task list for straightforward tracking" },
];

export default function CreateOrganizationModal({ tenantId, onClose, onCreated }: { tenantId: string | null; onClose: () => void; onCreated: () => void }) {
    const client = dataClient();
    const models = client.models as any;
    const { alert } = useConfirm();

    const [step, setStep] = useState<"setup" | "invite" | "summary">("setup");
    const [loading, setLoading] = useState(false);

    // Step 1 — org + workspace + board config
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [boardType, setBoardType] = useState("KANBAN");
    const [workspaceName, setWorkspaceName] = useState("");
    const [boardName, setBoardName] = useState("");

    // Step 2 — invites
    const [ownerEmail, setOwnerEmail] = useState("");
    const [memberEmails, setMemberEmails] = useState<string[]>([""]);

    // Shared
    const [createdOrgId, setCreatedOrgId] = useState("");
    const [createdWorkspaceId, setCreatedWorkspaceId] = useState("");
    const [createdBoardId, setCreatedBoardId] = useState("");
    const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);

    // Derived defaults
    const resolvedWorkspaceName = workspaceName.trim() || (name.trim() ? `${name.trim()} Workspace` : "");
    const resolvedBoardName = boardName.trim() || (name.trim() ? `${name.trim()} Board` : "");

    // ─── Step 1: Create org + workspace + board ───
    async function handleCreate() {
        if (!name.trim()) {
            await alert({ title: "Missing Name", message: "Enter an organization name.", variant: "warning" });
            return;
        }

        setLoading(true);
        try {
            if (!tenantId) {
                await alert({ title: "Error", message: "Could not determine tenant.", variant: "danger" });
                setLoading(false);
                return;
            }
            const tenantIdForApi: string = ensureString(tenantId, "tenantId");

            // Plan limit check
            const tenantRes = await models.Tenant.get({ id: tenantIdForApi });
            const plan = tenantRes.data?.plan;
            const limits = getPlanLimits(plan);

            const orgCountRes = await models.Organization.list({
                filter: { tenantId: { eq: tenantIdForApi } },
            });
            const existingOrgs = (orgCountRes.data || []).filter((o: any) => o.isActive !== false).length;
            if (existingOrgs >= limits.orgs) {
                await alert({
                    title: "Organization limit reached",
                    message: `You already have ${existingOrgs} organization(s) (plan: ${plan || "Free"}). ${formatPlanLimitMessage(plan)}`,
                    variant: "warning",
                });
                setLoading(false);
                return;
            }

            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken?.payload?.sub as string;

            // 1. Create organization
            const orgResult = await models.Organization.create({
                tenantId: tenantIdForApi,
                name: name.trim(),
                description: description.trim() || undefined,
                createdBy: sub,
                isActive: true,
            });

            if (!orgResult.data?.id) {
                await alert({ title: "Error", message: "Error creating organization — no ID returned.", variant: "danger" });
                setLoading(false);
                return;
            }

            const orgId = orgResult.data.id;
            setCreatedOrgId(orgId);

            logAudit({
                tenantId: tenantIdForApi,
                organizationId: orgId,
                action: "CREATE",
                resourceType: "Organization",
                resourceId: orgId,
                userId: sub,
                metadata: { name: name.trim() },
            });

            // 2. Create default workspace
            const wsResult = await models.Workspace.create({
                tenantId: tenantIdForApi,
                organizationId: orgId,
                name: resolvedWorkspaceName,
                isActive: true,
                createdBy: sub,
                createdAt: new Date().toISOString(),
            });

            if (wsResult.data?.id) {
                setCreatedWorkspaceId(wsResult.data.id);

                logAudit({
                    tenantId: tenantIdForApi,
                    organizationId: orgId,
                    action: "CREATE",
                    resourceType: "Workspace",
                    resourceId: wsResult.data.id,
                    userId: sub,
                    metadata: { name: resolvedWorkspaceName },
                });

                // 3. Create first task board
                const boardResult = await models.TaskBoard.create({
                    tenantId: tenantIdForApi,
                    organizationId: orgId,
                    workspaceId: wsResult.data.id,
                    name: resolvedBoardName,
                    boardType,
                    ownerUserSub: sub,
                    createdBy: sub,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                });

                if (boardResult.data?.id) {
                    setCreatedBoardId(boardResult.data.id);

                    logAudit({
                        tenantId: tenantIdForApi,
                        organizationId: orgId,
                        workspaceId: wsResult.data.id,
                        action: "CREATE",
                        resourceType: "TaskBoard",
                        resourceId: boardResult.data.id,
                        userId: sub,
                        metadata: { name: resolvedBoardName, boardType },
                    });
                }
            }

            setStep("invite");
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating organization.", variant: "danger" });
        }
        setLoading(false);
    }

    // ─── Step 2: Send invites ───
    async function handleSendInvites() {
        const invites: { email: string; role: string }[] = [];

        const owner = ownerEmail.trim().toLowerCase();
        if (owner) {
            invites.push({ email: owner, role: "OWNER" });
        }

        const members = memberEmails
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e !== "");

        if (owner && members.includes(owner)) {
            await alert({ title: "Duplicate Email", message: "Owner email also appears in the member list. Please remove the duplicate.", variant: "warning" });
            return;
        }

        const uniqueMembers = new Set(members);
        if (uniqueMembers.size < members.length) {
            await alert({ title: "Duplicate Emails", message: "Duplicate emails in the member list. Please remove duplicates.", variant: "warning" });
            return;
        }

        for (const email of members) {
            invites.push({ email, role: "MEMBER" });
        }

        if (invites.length === 0) {
            onCreated();
            return;
        }

        setLoading(true);
        const results: InviteResult[] = [];

        for (const invite of invites) {
            try {
                const res = await client.mutations.inviteMemberToOrg({
                    email: invite.email,
                    organizationId: createdOrgId,
                    tenantId: tenantId!,
                    role: invite.role,
                });

                if (res.data?.success) {
                    logAudit({
                        tenantId: tenantId!,
                        organizationId: createdOrgId,
                        action: "INVITE",
                        resourceType: "Membership",
                        resourceId: invite.email,
                        metadata: { email: invite.email, role: invite.role },
                    });
                    results.push({ email: invite.email, role: invite.role, success: true, message: "Sent" });
                } else {
                    const errMsg =
                        res.data?.message ||
                        (res.errors?.map((e: any) => e.message).join("; ")) ||
                        "Failed";
                    results.push({
                        email: invite.email,
                        role: invite.role,
                        success: false,
                        message: errMsg,
                    });
                }
            } catch (err: any) {
                results.push({
                    email: invite.email,
                    role: invite.role,
                    success: false,
                    message: err.message || "Error sending invite",
                });
            }
        }

        setInviteResults(results);
        setStep("summary");
        setLoading(false);
    }

    function updateMemberEmail(index: number, value: string) {
        const updated = [...memberEmails];
        updated[index] = value;
        setMemberEmails(updated);
    }

    function removeMemberEmail(index: number) {
        const updated = memberEmails.filter((_, i) => i !== index);
        if (updated.length === 0) updated.push("");
        setMemberEmails(updated);
    }


    // ─── Summary ───
    if (step === "summary") {
        return (
            <div className="modal-backdrop">
                <div className="modal modern">
                    <div className="modal-header">
                        <div style={styles.stepIndicator}>Step 3 of 3</div>
                        <h2>All Set!</h2>
                        <div className="modal-sub">Your organization is ready to use</div>
                    </div>

                    <div className="modal-body">
                        {/* What was created */}
                        <div style={styles.createdSummary}>
                            <div style={styles.createdItem}>
                                <div style={styles.createdIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                </div>
                                <div>
                                    <div style={styles.createdLabel}>Organization</div>
                                    <div style={styles.createdValue}>{name}</div>
                                </div>
                            </div>
                            {createdWorkspaceId && (
                                <div style={styles.createdItem}>
                                    <div style={styles.createdIcon}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </div>
                                    <div>
                                        <div style={styles.createdLabel}>Workspace</div>
                                        <div style={styles.createdValue}>{resolvedWorkspaceName}</div>
                                    </div>
                                </div>
                            )}
                            {createdBoardId && (
                                <div style={styles.createdItem}>
                                    <div style={styles.createdIcon}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </div>
                                    <div>
                                        <div style={styles.createdLabel}>Board ({BOARD_TYPES.find(b => b.value === boardType)?.label})</div>
                                        <div style={styles.createdValue}>{resolvedBoardName}</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Invite results */}
                        {inviteResults.length > 0 && (
                            <>
                                <div style={styles.divider} />
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>Invitations</div>
                                {inviteResults.map((r, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "8px 0",
                                            borderBottom: "1px solid #f1f5f9",
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500, fontSize: 14 }}>{r.email}</div>
                                            <div style={{ fontSize: 12, color: "#64748b" }}>{r.role}</div>
                                        </div>
                                        <span className={`badge ${r.success ? "green" : "red"}`}>
                                            {r.success ? "Sent" : "Failed"}
                                        </span>
                                    </div>
                                ))}

                                {inviteResults.some((r) => !r.success) && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>
                                        {inviteResults
                                            .filter((r) => !r.success)
                                            .map((r) => `${r.email}: ${r.message}`)
                                            .join(". ")}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button className="btn primary" onClick={() => onCreated()}>
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Step 1: Organization Setup ───
    if (step === "setup") {
        return (
            <div className="modal-backdrop">
                <div className="modal modern">
                    <div className="modal-header">
                        <div style={styles.stepIndicator}>Step 1 of 3</div>
                        <h2>Set Up Organization</h2>
                        <div className="modal-sub">Configure your organization, workspace, and board type</div>
                    </div>

                    <div className="modal-body">
                        {/* ORG NAME */}
                        <label htmlFor="org-name">Organization Name <span style={{ color: "#ef4444" }}>*</span></label>
                        <input
                            id="org-name"
                            name="org_name"
                            placeholder="e.g. Acme Corp, Q1 Strategy"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />

                        {/* DESCRIPTION */}
                        <label htmlFor="org-description">What will this organization work on?</label>
                        <input
                            id="org-description"
                            name="org_description"
                            placeholder="e.g. Marketing campaigns, Product launch, Client onboarding"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        {/* BOARD TYPE */}
                        <label>How do you want to manage work?</label>
                        <div style={styles.boardTypeGrid}>
                            {BOARD_TYPES.map((bt) => (
                                <div
                                    key={bt.value}
                                    style={{
                                        ...styles.boardTypeCard,
                                        ...(boardType === bt.value ? styles.boardTypeCardActive : {}),
                                    }}
                                    onClick={() => setBoardType(bt.value)}
                                >
                                    <div style={styles.boardTypeHeader}>
                                        <div style={{
                                            ...styles.boardTypeRadio,
                                            ...(boardType === bt.value ? styles.boardTypeRadioActive : {}),
                                        }}>
                                            {boardType === bt.value && <div style={styles.boardTypeRadioDot} />}
                                        </div>
                                        <div style={styles.boardTypeLabel}>{bt.label}</div>
                                    </div>
                                    <div style={styles.boardTypeDesc}>{bt.desc}</div>
                                </div>
                            ))}
                        </div>

                        {/* WORKSPACE NAME */}
                        <label htmlFor="org-workspace-name">Workspace Name</label>
                        <input
                            id="org-workspace-name"
                            name="org_workspace_name"
                            placeholder={name.trim() ? `${name.trim()} Workspace` : "Auto-generated from org name"}
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                        />

                        {/* BOARD NAME */}
                        <label htmlFor="org-board-name">Board Name</label>
                        <input
                            id="org-board-name"
                            name="org_board_name"
                            placeholder={name.trim() ? `${name.trim()} Board` : "Auto-generated from org name"}
                            value={boardName}
                            onChange={(e) => setBoardName(e.target.value)}
                        />
                    </div>

                    <div className="modal-footer">
                        <button className="btn ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="btn primary" onClick={handleCreate} disabled={loading}>
                            {loading ? "Setting up..." : "Create & Continue"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Step 2: Invite Team (optional) ───
    return (
        <div className="modal-backdrop">
            <div className="modal modern">
                <div className="modal-header">
                    <div style={styles.stepIndicator}>Step 2 of 3</div>
                    <h2>Invite Your Team</h2>
                    <div className="modal-sub">
                        Add people to <strong>{name}</strong> — you can skip this and invite later
                    </div>
                </div>

                <div className="modal-body">

                    {/* OWNER */}
                    <label htmlFor="org-owner-email">Owner (optional, 1 max)</label>
                    <input
                        id="org-owner-email"
                        name="org_owner_email"
                        type="email"
                        placeholder="owner@company.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                    />

                    {/* MEMBERS */}
                    <label htmlFor="org-member-email-0" style={{ marginTop: 8 }}>Members (optional)</label>
                    {memberEmails.map((email, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                id={`org-member-email-${i}`}
                                name={`org_member_email_${i}`}
                                type="email"
                                placeholder="member@company.com"
                                value={email}
                                onChange={(e) => updateMemberEmail(i, e.target.value)}
                                style={{ flex: 1 }}
                            />
                            {memberEmails.length > 1 && (
                                <button
                                    className="btn ghost"
                                    style={{ padding: "6px 10px", minWidth: "auto" }}
                                    onClick={() => removeMemberEmail(i)}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}

                    <button
                        onClick={() => setMemberEmails([...memberEmails, ""])}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            cursor: "pointer",
                            fontSize: 13,
                            padding: 0,
                            fontWeight: 600,
                            marginTop: 4,
                        }}
                    >
                        + Add another member
                    </button>

                    <div style={styles.inviteNote}>
                        Invited members will be asked to complete their profile (name) when they first sign in.
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn ghost" onClick={() => onCreated()}>
                        Skip
                    </button>
                    <button className="btn primary" onClick={handleSendInvites} disabled={loading}>
                        {loading ? "Sending..." : "Send Invites"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    stepIndicator: {
        fontSize: 11,
        fontWeight: 700,
        color: "#6366f1",
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        marginBottom: 6,
    },
    boardTypeGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginTop: 4,
        marginBottom: 8,
    },
    boardTypeCard: {
        border: "1.5px solid #e2e8f0",
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
    },
    boardTypeCardActive: {
        borderColor: "#6366f1",
        background: "#f5f3ff",
    },
    boardTypeHeader: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
    },
    boardTypeRadio: {
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: "2px solid #cbd5e1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    boardTypeRadioActive: {
        borderColor: "#6366f1",
    },
    boardTypeRadioDot: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#6366f1",
    },
    boardTypeLabel: {
        fontSize: 13,
        fontWeight: 600,
        color: "#0f172a",
    },
    boardTypeDesc: {
        fontSize: 11,
        color: "#64748b",
        lineHeight: 1.4,
        marginLeft: 24,
    },
    createdSummary: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
    },
    createdItem: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    createdIcon: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#ecfdf5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    createdLabel: {
        fontSize: 11,
        color: "#64748b",
        fontWeight: 600,
    },
    createdValue: {
        fontSize: 14,
        fontWeight: 600,
        color: "#0f172a",
    },
    divider: {
        borderTop: "1px solid #e2e8f0",
        margin: "14px 0",
    },
    inviteNote: {
        fontSize: 12,
        color: "#64748b",
        marginTop: 14,
        padding: "10px 12px",
        background: "#f8fafc",
        borderRadius: 8,
        lineHeight: 1.5,
    },
};
