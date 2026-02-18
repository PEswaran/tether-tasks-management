import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { getTenantId } from "../libs/isTenantAdmin";
import { useConfirm } from "../shared-components/confirm-context";

type InviteResult = { email: string; role: string; success: boolean; message: string };

export default function CreateOrganizationModal({ onClose, onCreated }: any) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [step, setStep] = useState<"create" | "invite" | "summary">("create");
    const [loading, setLoading] = useState(false);

    // Step 1
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    // Step 2 — all invites on one screen
    const [ownerEmail, setOwnerEmail] = useState("");
    const [memberEmails, setMemberEmails] = useState<string[]>([""]);

    // Shared
    const [createdOrgId, setCreatedOrgId] = useState("");
    const [tenantId, setTenantId] = useState("");
    const [inviteResults, setInviteResults] = useState<InviteResult[]>([]);

    useEffect(() => {
        getTenantId().then((id) => {
            if (id) setTenantId(id);
        });
    }, []);

    // Step 1: create the workspace
    async function handleCreate() {
        if (!name.trim()) {
            await alert({ title: "Missing Name", message: "Enter a workspace name", variant: "warning" });
            return;
        }

        setLoading(true);
        try {
            if (!tenantId) {
                await alert({ title: "Error", message: "Could not determine tenant", variant: "danger" });
                setLoading(false);
                return;
            }

            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken?.payload?.sub as string;

            const result = await client.models.Workspace.create({
                tenantId,
                name: name.trim(),
                description: description.trim() || undefined,
                createdBy: sub,
                isActive: true,
            });

            if (!result.data?.id) {
                await alert({ title: "Error", message: "Error creating workspace — no ID returned", variant: "danger" });
                setLoading(false);
                return;
            }

            setCreatedOrgId(result.data.id);
            setStep("invite");
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating workspace", variant: "danger" });
        }
        setLoading(false);
    }

    // Step 2: send all invites
    async function handleSendInvites() {
        const invites: { email: string; role: string }[] = [];

        const owner = ownerEmail.trim().toLowerCase();
        if (owner) {
            invites.push({ email: owner, role: "OWNER" });
        }

        const members = memberEmails
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e !== "");

        // Duplicate checks
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
                    workspaceId: createdOrgId,
                    tenantId,
                    role: invite.role,
                });

                if (res.data?.success) {
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
                        <h2>Invitations Sent</h2>
                        <div className="modal-sub">Results for {name}</div>
                    </div>

                    <div className="modal-body">
                        {inviteResults.map((r, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 0",
                                    borderBottom: "1px solid #f1f5f9",
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 500 }}>{r.email}</div>
                                    <div style={{ fontSize: 12, color: "#64748b" }}>{r.role}</div>
                                </div>
                                <span
                                    className={`badge ${r.success ? "green" : "red"}`}
                                >
                                    {r.success ? "Sent" : "Failed"}
                                </span>
                            </div>
                        ))}

                        {inviteResults.some((r) => !r.success) && (
                            <div style={{ marginTop: 12, fontSize: 13, color: "#dc2626" }}>
                                {inviteResults
                                    .filter((r) => !r.success)
                                    .map((r) => `${r.email}: ${r.message}`)
                                    .join(". ")}
                            </div>
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

    // ─── Step 1: Create Workspace ───
    if (step === "create") {
        return (
            <div className="modal-backdrop">
                <div className="modal modern">
                    <div className="modal-header">
                        <h2>Create Workspace</h2>
                        <div className="modal-sub">Set up a new workspace for your team</div>
                    </div>

                    <div className="modal-body">
                        <label>Name</label>
                        <input
                            placeholder="e.g. Marketing, Engineering"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <label>Description</label>
                        <input
                            placeholder="Optional"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="modal-footer">
                        <button className="btn ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="btn primary" onClick={handleCreate} disabled={loading}>
                            {loading ? "Creating..." : "Create & Continue"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Step 2: Invite Owner + Members (single screen) ───
    return (
        <div className="modal-backdrop">
            <div className="modal modern">
                <div className="modal-header">
                    <h2>Invite People</h2>
                    <div className="modal-sub">
                        Add people to <strong>{name}</strong> — you can skip this and invite later
                    </div>
                </div>

                <div className="modal-body">

                    {/* OWNER */}
                    <label>Owner (optional, 1 max)</label>
                    <input
                        type="email"
                        placeholder="owner@company.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                    />

                    {/* MEMBERS */}
                    <label style={{ marginTop: 8 }}>Members (optional)</label>
                    {memberEmails.map((email, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
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
