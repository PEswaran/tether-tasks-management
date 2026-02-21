import { useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useConfirm } from "../../../shared-components/confirm-context";

export default function EditOrganizationModal({ organization, onClose, onUpdated }: any) {
    const client = dataClient();
    const { alert } = useConfirm();

    const [name, setName] = useState(organization.name || "");
    const [description, setDescription] = useState(organization.description || "");
    const [loading, setLoading] = useState(false);

    async function updateOrganization() {
        if (!name) {
            await alert({ title: "Missing Name", message: "Enter organization name", variant: "warning" });
            return;
        }

        setLoading(true);

        try {
            await client.models.Workspace.update({
                id: organization.id,
                name,
                description: description || undefined,
            });

            onUpdated();
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error updating organization", variant: "danger" });
        }

        setLoading(false);
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Edit Organization</h2>

                <input
                    placeholder="Organization name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <input
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                <div style={{ marginTop: 20 }}>
                    <button className="btn" onClick={updateOrganization} disabled={loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                        className="btn secondary"
                        style={{ marginLeft: 10 }}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
