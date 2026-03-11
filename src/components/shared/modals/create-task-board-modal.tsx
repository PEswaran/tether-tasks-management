import { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { getMyTenantId } from "../../../libs/isOwner";
import { useConfirm } from "../../../shared-components/confirm-context";
import { displayName } from "../../../libs/displayName";
import { logAudit } from "../../../libs/audit";

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

const WORKFLOW_TEMPLATES = [
    {
        value: "KANBAN",
        label: "Kanban Workflow",
        desc: "Best for ongoing execution across clear stages.",
        preview: ["Backlog", "In Progress", "Done"],
        starterTasks: [
            { title: "Add first priority", status: "TODO", priority: "HIGH" },
            { title: "Assign active work", status: "IN_PROGRESS", priority: "MEDIUM" },
            { title: "Review completed work", status: "DONE", priority: "LOW" },
        ],
    },
    {
        value: "TIMELINE",
        label: "Timeline Setup",
        desc: "Best for launches, deadlines, and milestone-driven work.",
        preview: ["Milestones", "Deadlines", "Launches"],
        starterTasks: [
            { title: "Define launch milestone", status: "TODO", priority: "HIGH" },
            { title: "Confirm delivery deadline", status: "TODO", priority: "HIGH" },
            { title: "Prepare launch checklist", status: "IN_PROGRESS", priority: "MEDIUM" },
        ],
    },
    {
        value: "PROCESS",
        label: "Process Tracker",
        desc: "Best for repeatable operational workflows and approvals.",
        preview: ["Intake", "Review", "Complete"],
        starterTasks: [
            { title: "Capture new request", status: "TODO", priority: "MEDIUM" },
            { title: "Review process step", status: "IN_PROGRESS", priority: "MEDIUM" },
            { title: "Finalize and document", status: "DONE", priority: "LOW" },
        ],
    },
    {
        value: "LIST",
        label: "Simple Task List",
        desc: "Best for lightweight teams that just need a clean starting point.",
        preview: ["To Do", "Next Up", "Done"],
        starterTasks: [
            { title: "Add first team to-do", status: "TODO", priority: "MEDIUM" },
            { title: "Set upcoming priority", status: "TODO", priority: "LOW" },
            { title: "Mark a completed win", status: "DONE", priority: "LOW" },
        ],
    },
] as const;

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
    const [boardType, setBoardType] = useState<(typeof WORKFLOW_TEMPLATES)[number]["value"]>("KANBAN");
    const workspaceOptions = workspaces?.length ? workspaces : (organizations || []);
    const [workspaceId, setworkspaceId] = useState(forcedWorkspaceId || workspaceOptions[0]?.id || "");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const selectedTemplate = WORKFLOW_TEMPLATES.find((template) => template.value === boardType) || WORKFLOW_TEMPLATES[0];

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
                boardType,
                ownerUserSub: sub,
                createdBy: sub,
                isActive: true,
                createdAt: new Date().toISOString(),
            });

            if (created?.data?.id) {
                logAudit({
                    tenantId,
                    organizationId: resolvedOrganizationId,
                    workspaceId,
                    action: "CREATE",
                    resourceType: "TaskBoard",
                    resourceId: created.data.id,
                    userId: sub,
                    metadata: { name, boardType },
                });

                for (const task of selectedTemplate.starterTasks) {
                    await client.models.Task.create({
                        tenantId,
                        organizationId: resolvedOrganizationId,
                        workspaceId,
                        taskBoardId: created.data.id,
                        title: task.title,
                        status: task.status,
                        priority: task.priority,
                        createdBy: sub,
                        createdAt: new Date().toISOString(),
                    });
                }
            }

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

                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4, marginBottom: 8 }}>
                    Workflow Template
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {WORKFLOW_TEMPLATES.map((template) => (
                        <button
                            key={template.value}
                            type="button"
                            onClick={() => setBoardType(template.value)}
                            style={{
                                textAlign: "left",
                                padding: "12px 12px 10px",
                                borderRadius: 10,
                                border: boardType === template.value ? "1.5px solid #1455a5" : "1px solid #d8e6f3",
                                background: boardType === template.value ? "#eaf4ff" : "#fff",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#123868", marginBottom: 4 }}>
                                {template.label}
                            </div>
                            <div style={{ fontSize: 11, color: "#5f7694", lineHeight: 1.4 }}>
                                {template.desc}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                                {template.preview.map((item) => (
                                    <span
                                        key={item}
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: "#1455a5",
                                            background: "#f8fbff",
                                            border: "1px solid #dbe7f3",
                                            borderRadius: 999,
                                            padding: "3px 8px",
                                        }}
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </button>
                    ))}
                </div>

                <label
                    htmlFor="task-board-name"
                    style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 4, marginBottom: 4 }}
                >
                    Board Name
                </label>
                <div style={{ fontSize: 11, color: "#5f7694", marginBottom: 8 }}>
                    Name the board this team will start working from.
                </div>
                <input
                    id="task-board-name"
                    name="task_board_name"
                    placeholder={selectedTemplate.label}
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
