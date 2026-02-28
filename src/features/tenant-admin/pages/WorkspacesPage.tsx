import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { useConfirm } from "../../../shared-components/confirm-context";
import { getPlanLimits, formatPlanLimitMessage } from "../../../libs/planLimits";

function ensureString(value: string | null | undefined, label: string): string {
    if (!value) {
        throw new Error(`${label} is required`);
    }
    return value;
}

function CreateWorkspaceModal({ organizationId, tenantId, onClose, onCreated }: any) {
    const client = dataClient();
    const modalModels = client.models as any;
    const { alert } = useConfirm();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    async function createWorkspace() {
        if (!organizationId || !tenantId) {
            await alert({ title: "Error", message: "Organization not selected", variant: "danger" });
            return;
        }
        if (!name.trim()) {
            await alert({ title: "Missing Name", message: "Enter a workspace name", variant: "warning" });
            return;
        }

        setLoading(true);
        try {
            const tenantIdForApi: string = ensureString(tenantId, "tenantId");
            const organizationIdForApi: string = ensureString(organizationId, "organizationId");
            const tenantRes = await modalModels.Tenant.get({ id: tenantIdForApi });
            const plan = tenantRes.data?.plan;
            const limits = getPlanLimits(plan);
            const maxWorkspacesPerOrg = limits.workspaces;
            const maxWorkspacesTenantWide = limits.workspaces * limits.orgs;

            const wsCountRes = await modalModels.Workspace.list({
                filter: {
                    tenantId: {
                        eq: tenantIdForApi,
                    },
                },
            });
            // Exclude system/default tenant-level workspaces (no organizationId) from org workspace limits.
            const activeOrgWorkspaces = (wsCountRes.data || []).filter(
                (w: any) => w.isActive !== false && Boolean(w.organizationId)
            );
            const existingWorkspaces = activeOrgWorkspaces.length;
            const existingWorkspacesInOrg = activeOrgWorkspaces.filter(
                (w: any) => w.organizationId === organizationIdForApi
            ).length;

            if (existingWorkspacesInOrg >= maxWorkspacesPerOrg) {
                await alert({
                    title: "Workspace limit reached",
                    message: `This organization already has ${existingWorkspacesInOrg} workspace(s). Max ${maxWorkspacesPerOrg} per organization.`,
                    variant: "warning",
                });
                setLoading(false);
                return;
            }

            if (existingWorkspaces >= maxWorkspacesTenantWide) {
                await alert({
                    title: "Workspace limit reached",
                    message: `You already have ${existingWorkspaces} workspace(s) across all organizations (max ${maxWorkspacesTenantWide}). ${formatPlanLimitMessage(plan)}`,
                    variant: "warning",
                });
                setLoading(false);
                return;
            }

            const res = await modalModels.Workspace.create({
                tenantId: tenantIdForApi,
                organizationId: organizationIdForApi,
                name: name.trim(),
                description: description.trim() || undefined,
                isActive: true,
                createdAt: new Date().toISOString(),
            });

            if (!res.data?.id) {
                await alert({ title: "Error", message: "Error creating workspace — no ID returned", variant: "danger" });
                setLoading(false);
                return;
            }

            onCreated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error creating workspace", variant: "danger" });
        }
        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Create Workspace</h2>

                <label htmlFor="workspace-name">Name</label>
                <input
                    id="workspace-name"
                    name="workspace_name"
                    placeholder="e.g. Marketing, Engineering"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <label htmlFor="workspace-description">Description</label>
                <input
                    id="workspace-description"
                    name="workspace_description"
                    placeholder="Optional"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={createWorkspace} disabled={loading}>
                        {loading ? "Creating..." : "Create Workspace"}
                    </button>
                    <button className="btn secondary" style={{ marginLeft: 10 }} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default function WorkspacesPage() {
    const client = dataClient();
    const models = client.models as any;
    const navigate = useNavigate();
    const { confirm, alert } = useConfirm();

    const { tenantId, organizationId, setOrganizationId, organizations, refreshWorkspaces } = useWorkspace();

    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [planMetrics, setPlanMetrics] = useState({
        plan: "STARTER",
        perOrgLimit: 1,
        orgUsed: 0,
        tenantLimit: 1,
        tenantUsed: 0,
        activeInOrg: 0,
        inactiveInOrg: 0,
    });

    const activeOrg = useMemo(
        () => organizations.find((o: any) => o.id === organizationId) || null,
        [organizations, organizationId]
    );

    useEffect(() => {
        if (!organizationId && organizations.length > 0) {
            setOrganizationId(organizations[0].id);
        }
    }, [organizationId, organizations, setOrganizationId]);

    useEffect(() => {
        load();
    }, [tenantId, organizationId]);

    async function load() {
        if (!tenantId || !organizationId) return;
        const tenantIdForApi = ensureString(tenantId, "tenantId");
        const organizationIdForApi = ensureString(organizationId, "organizationId");

        const [orgWsRes, tenantWsRes, tenantRes] = await Promise.all([
            models.Workspace.list({
                filter: {
                    organizationId: {
                        eq: organizationIdForApi,
                    },
                },
            }),
            models.Workspace.list({
                filter: {
                    tenantId: {
                        eq: tenantIdForApi,
                    },
                },
            }),
            models.Tenant.get({ id: tenantIdForApi }),
        ]);

        const orgWorkspaces = orgWsRes.data || [];
        const tenantWorkspaces = (tenantWsRes.data || []).filter((w: any) => Boolean(w.organizationId));
        const plan = String(tenantRes?.data?.plan || "STARTER").toUpperCase();
        const limits = getPlanLimits(plan);

        const activeInOrg = orgWorkspaces.filter((w: any) => w.isActive !== false).length;
        const inactiveInOrg = orgWorkspaces.length - activeInOrg;
        const tenantUsed = tenantWorkspaces.filter((w: any) => w.isActive !== false).length;

        setWorkspaces(orgWorkspaces);
        setPlanMetrics({
            plan,
            perOrgLimit: limits.workspaces,
            orgUsed: activeInOrg,
            tenantLimit: limits.workspaces * limits.orgs,
            tenantUsed,
            activeInOrg,
            inactiveInOrg,
        });
    }

    async function removeWorkspace(id: string) {
        if (!await confirm({ title: "Remove Workspace", message: "Are you sure you want to remove this workspace?", confirmLabel: "Remove", variant: "danger" })) return;

        try {
            await client.models.Workspace.delete({ id });
            load();
            refreshWorkspaces();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error removing workspace", variant: "danger" });
        }
    }

    return (
        <div>
            <div className="page-title">Workspaces</div>

            <div className="workspace-page-controls">
                <select
                    id="tenant-workspaces-organization-select"
                    name="tenant_workspaces_organization_select"
                    className="workspace-page-org-select"
                    value={organizationId || ""}
                    onChange={(e) => setOrganizationId(e.target.value || null)}
                >
                    <option value="">Select organization</option>
                    {organizations.map((org: any) => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                </select>

                <button className="workspace-page-btn workspace-page-btn-primary" onClick={() => setShowCreate(true)} disabled={!organizationId}>
                    + Create Workspace
                </button>

                {activeOrg && (
                    <button className="workspace-page-btn workspace-page-btn-secondary" onClick={() => navigate(`/tenant/organizations`)}>
                        View Organizations
                    </button>
                )}
            </div>

            {showCreate && organizationId && (
                <CreateWorkspaceModal
                    organizationId={organizationId}
                    tenantId={tenantId}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
                        refreshWorkspaces();
                    }}
                />
            )}

            <div className="workspace-metrics-grid">
                <div className="workspace-metric-card">
                    <div className="workspace-metric-label">Org Workspace Limit</div>
                    <div className="workspace-metric-value">{planMetrics.orgUsed} / {planMetrics.perOrgLimit}</div>
                    <div className="workspace-metric-track">
                        <div
                            className={`workspace-metric-fill ${planMetrics.orgUsed > planMetrics.perOrgLimit ? "over" : ""}`}
                            style={{ width: `${Math.min(100, Math.round((planMetrics.orgUsed / Math.max(planMetrics.perOrgLimit, 1)) * 100))}%` }}
                        />
                    </div>
                </div>
                {!organizationId && (
                    <div className="workspace-metric-card">
                        <div className="workspace-metric-label">Tenant Workspace Capacity</div>
                        <div className="workspace-metric-value">{planMetrics.tenantUsed} / {planMetrics.tenantLimit}</div>
                        <div className="workspace-metric-track">
                            <div
                                className={`workspace-metric-fill ${planMetrics.tenantUsed > planMetrics.tenantLimit ? "over" : ""}`}
                                style={{ width: `${Math.min(100, Math.round((planMetrics.tenantUsed / Math.max(planMetrics.tenantLimit, 1)) * 100))}%` }}
                            />
                        </div>
                    </div>
                )}
                <div className="workspace-metric-card">
                    <div className="workspace-metric-label">Active in Selected Org</div>
                    <div className="workspace-metric-value">{planMetrics.activeInOrg}</div>
                    <div className="workspace-metric-meta">Inactive: {planMetrics.inactiveInOrg}</div>
                </div>
                <div className="workspace-metric-card">
                    <div className="workspace-metric-label">Remaining in Org</div>
                    <div className="workspace-metric-value">{Math.max(0, planMetrics.perOrgLimit - planMetrics.orgUsed)}</div>
                    <div className="workspace-metric-meta">Plan: {planMetrics.plan}</div>
                </div>
            </div>

            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    {workspaces.map((ws) => (
                        <tr key={ws.id}>
                            <td>
                                <button
                                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 500, fontSize: 14, padding: 0 }}
                                    onClick={() => navigate(`/tenant/tasks?workspace=${ws.id}`)}
                                >
                                    {ws.name}
                                </button>
                            </td>
                            <td>{ws.description || "—"}</td>
                            <td>{ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : "—"}</td>
                            <td>
                                <button className="btn secondary" onClick={() => removeWorkspace(ws.id)}>Remove</button>
                            </td>
                        </tr>
                    ))}

                    {workspaces.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: "center", color: "#94a3b8" }}>
                                No workspaces yet
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
