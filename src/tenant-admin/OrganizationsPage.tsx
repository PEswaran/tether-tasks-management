import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "../libs/data-client";
import { useWorkspace } from "../shared-components/workspace-context";
import CreateOrganizationModal from "./CreateOrganizationModal";
import EditOrganizationModal from "./EditOrganizationModal";
import { useConfirm } from "../shared-components/confirm-context";

export default function OrganizationsPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const { confirm, alert } = useConfirm();
    const { tenantId, refreshWorkspaces } = useWorkspace();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editOrg, setEditOrg] = useState<any>(null);

    useEffect(() => { load(); }, [tenantId]);

    async function load() {
        if (!tenantId) return;

        const res = await client.models.Workspace.list({
            filter: { tenantId: { eq: tenantId } },
        });
        setOrganizations(res.data);
    }

    async function removeOrganization(id: string) {
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

            <button
                className="btn"
                style={{ marginBottom: 20 }}
                onClick={() => setShowCreate(true)}
            >
                + Create Workspace
            </button>

            {showCreate && (
                <CreateOrganizationModal
                    tenantId={tenantId}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
                        refreshWorkspaces();
                    }}
                />
            )}

            {editOrg && (
                <EditOrganizationModal
                    organization={editOrg}
                    onClose={() => setEditOrg(null)}
                    onUpdated={() => {
                        setEditOrg(null);
                        load();
                    }}
                />
            )}

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
                    {organizations.map((org) => (
                        <tr key={org.id}>
                            <td>
                                <button
                                    style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 500, fontSize: 14, padding: 0 }}
                                    onClick={() => navigate(`/tenant/tasks?workspace=${org.id}`)}
                                >
                                    {org.name}
                                </button>
                            </td>
                            <td>{org.description || "—"}</td>
                            <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                            <td>
                                <button
                                    className="btn secondary"
                                    style={{ marginRight: 8 }}
                                    onClick={() => setEditOrg(org)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn secondary"
                                    onClick={() => removeOrganization(org.id)}
                                >
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
