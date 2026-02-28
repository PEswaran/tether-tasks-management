import { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { getMyTenantId } from "../../../libs/isOwner";
import { useConfirm } from "../../../shared-components/confirm-context";
import { displayName } from "../../../libs/displayName";

type Member = {
    email?: string | null;
    workspaceId?: string | null;
    organizationId?: string | null;
    userSub?: string | null;
    status?: string | null;
};

type WorkspaceOption = {
    id: string;
    name?: string;
    organizationId?: string | null;
};

export default function CreateTaskBoardModal({
    organizations,
    workspaces,
    members = [],
    onClose,
    onCreated,
    tenantId: tenantIdProp,
    templateMode = false,
    forcedWorkspaceId,
}: {
    organizations?: WorkspaceOption[];
    workspaces?: WorkspaceOption[];
    members?: Member[];
    onClose: () => void;
    onCreated: () => void;
    tenantId?: string | null;
    templateMode?: boolean;
    forcedWorkspaceId?: string;
}) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const workspaceOptions = workspaces?.length ? workspaces : (organizations || []);
    const [workspaceId, setworkspaceId] = useState(forcedWorkspaceId || workspaceOptions[0]?.id || "");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const ownerCandidates = useMemo<string[]>(() => {
        const filtered = members.filter((m) => m.workspaceId === workspaceId);
        const emails = filtered
            .map((m) => (m.email || "").toLowerCase())
            .filter((email) => Boolean(email));
        return Array.from(new Set<string>(emails));
    }, [members, workspaceId]);

    useEffect(() => {
        if (templateMode) return;
        if (ownerEmail) return;
        (async () => {
            try {
                const session = await fetchAuthSession();
                const email = session.tokens?.idToken?.payload?.email as string | undefined;
                if (email) setOwnerEmail(email.toLowerCase());
            } catch {
                // ignore
            }
        })();
    }, [ownerEmail, templateMode]);

    async function createBoard() {
        if (!name) { await alert({ title: "Missing Name", message: "Enter a board name", variant: "warning" }); return; }
        if (!workspaceId) { await alert({ title: "Missing Workspace", message: "Select a workspace", variant: "warning" }); return; }
        if (!templateMode && !ownerEmail.trim()) { await alert({ title: "Missing Owner", message: "Enter an owner email", variant: "warning" }); return; }

        setLoading(true);
        try {
            const tenantId = tenantIdProp || await getMyTenantId();
            if (!tenantId) { await alert({ title: "Error", message: "Could not determine tenant", variant: "danger" }); setLoading(false); return; }

            const session = await fetchAuthSession();
            const sub = session.tokens?.accessToken.payload.sub as string;
            const myEmail = (session.tokens?.idToken?.payload?.email as string | undefined)?.toLowerCase() || "";

            let ownerUserSub = sub;
            const desiredOwnerEmail = ownerEmail.trim().toLowerCase();

            if (!templateMode && desiredOwnerEmail && desiredOwnerEmail !== myEmail) {
                const memberMatch = members.find(
                    (m: any) =>
                        m.workspaceId === workspaceId &&
                        (m.email || "").toLowerCase() === desiredOwnerEmail
                );

                if (memberMatch?.userSub) {
                    ownerUserSub = memberMatch.userSub;
                } else {
                    try {
                        const profRes: any = await client.models.UserProfile.list({
                            filter: { email: { eq: desiredOwnerEmail } }
                        });
                        const prof = profRes?.data?.[0];
                        if (prof?.userId) ownerUserSub = prof.userId;
                    } catch {
                        // ignore lookup failures; invite will still be sent
                    }
                }
            }

            const selectedWorkspace = workspaceOptions.find((w: any) => w.id === workspaceId);
            const organizationId = selectedWorkspace?.organizationId;

            if (!templateMode && !organizationId) {
                await alert({ title: "Error", message: "Workspace is missing an organization.", variant: "danger" });
                setLoading(false);
                return;
            }
            const resolvedOrganizationId = organizationId!;

            const created = await client.models.TaskBoard.create({
                tenantId,
                organizationId: resolvedOrganizationId,
                workspaceId,
                name,
                description: description || undefined,
                ownerUserSub: sub,
                createdBy: sub,
                isActive: true,
                createdAt: new Date().toISOString(),
            });

            if (!templateMode && desiredOwnerEmail && desiredOwnerEmail !== myEmail && ownerUserSub !== sub && created?.data?.id) {
                try {
                    await client.models.TaskBoard.update({
                        id: created.data.id,
                        ownerUserSub,
                    });
                } catch (err) {
                    console.warn("Owner update failed:", err);
                }
            }

            if (!templateMode && desiredOwnerEmail && desiredOwnerEmail !== myEmail) {
                const alreadyMember = members.some(
                    (m: any) =>
                (resolvedOrganizationId ? m.organizationId === resolvedOrganizationId : m.workspaceId === workspaceId) &&
                (m.email || "").toLowerCase() === desiredOwnerEmail &&
                m.status === "ACTIVE"
            );

            if (!alreadyMember) {
                try {
                    await client.mutations.inviteMemberToOrg({
                        email: desiredOwnerEmail,
                        organizationId: resolvedOrganizationId,
                        tenantId,
                        role: "OWNER",
                        });
                    } catch (invErr: any) {
                        console.warn("Owner invite failed:", invErr);
                        await alert({
                            title: "Board created",
                            message: "Board was created, but the owner invite could not be sent.",
                            variant: "warning",
                        });
                    }
                }
            }

            if (!created?.data?.id) {
                await alert({ title: "Error", message: "Error creating task board — no ID returned", variant: "danger" });
                setLoading(false);
                return;
            }

            onCreated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating task board", variant: "danger" });
        }
        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Create Task Board</h2>

                <input
                    id="task-board-name"
                    name="task_board_name"
                    placeholder="Board name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <input
                    id="task-board-description"
                    name="task_board_description"
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                {workspaceOptions.length > 1 && (
                    <select
                        id="task-board-workspace"
                        name="task_board_workspace"
                        className="modal-select"
                        value={workspaceId}
                        onChange={(e) => setworkspaceId(e.target.value)}
                    >
                        {workspaceOptions.map((ws: any) => (
                            <option key={ws.id} value={ws.id}>{ws.name}</option>
                        ))}
                    </select>
                )}

                {!templateMode && (
                    <>
                        <label htmlFor="task-board-owner">Owner</label>
                        <input
                            id="task-board-owner"
                            name="task_board_owner"
                            type="email"
                            placeholder="owner@company.com"
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            list="owner-email-options"
                        />
                        {ownerCandidates.length > 0 && (
                            <datalist id="owner-email-options">
                                {ownerCandidates.map((email) => (
                                    <option key={email} value={email}>
                                        {displayName(email)}
                                    </option>
                                ))}
                            </datalist>
                        )}
                    </>
                )}

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={createBoard} disabled={loading}>
                        {loading ? "Creating..." : "Create Board"}
                    </button>
                    <button className="btn secondary" style={{ marginLeft: 10 }} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}
