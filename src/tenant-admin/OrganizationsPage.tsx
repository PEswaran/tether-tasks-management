import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getTenantId } from "../libs/isTenantAdmin";
import CreateOrganizationModal from "./CreateOrganizationModal";
import EditOrganizationModal from "./EditOrganizationModal";

export default function OrganizationsPage() {
    const client = dataClient();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editOrg, setEditOrg] = useState<any>(null);

    useEffect(() => { load(); }, []);

    async function load() {
        const tenantId = await getTenantId();
        if (!tenantId) return;

        const res = await client.models.Workspace.list({
            filter: { tenantId: { eq: tenantId } },
        });
        setOrganizations(res.data);
    }

    async function removeOrganization(id: string) {
        if (!window.confirm("Are you sure you want to remove this workspace?")) return;

        try {
            await client.models.Workspace.delete({ id });
            load();
        } catch (err) {
            console.error(err);
            alert("Error removing workspace");
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
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
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
                            <td>{org.name}</td>
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
