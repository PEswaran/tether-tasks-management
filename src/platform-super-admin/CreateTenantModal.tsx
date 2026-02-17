import { useState } from "react";
import { dataClient } from "../libs/data-client";

type Props = {
    onClose: () => void;
    onCreated: () => void;
};

export default function CreateTenantModal({ onClose, onCreated }: Props) {
    const client = dataClient();

    const [companyName, setCompanyName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [loading, setLoading] = useState(false);

    async function createCompany() {
        if (!companyName || !adminEmail) {
            alert("Company name and admin email required");
            return;
        }

        try {
            setLoading(true);

            const res = await client.mutations.createTenantAdmin({
                companyName,
                adminEmail,
            });

            if (!res.data?.success) {
                alert(res.data?.message || "Failed to create tenant");
                return;
            }

            onCreated();

        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-backdrop">
            <div className="modal large">
                <h2>Create Company</h2>

                {/* COMPANY INFO */}
                <div className="section">
                    <div className="section-title">Company Info</div>

                    <label>Company Name</label>
                    <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Inc"
                    />

                    <label>Admin Email</label>
                    <input
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@company.com"
                    />
                </div>

                {/* ACTIONS */}
                <div className="modal-actions">
                    <button className="btn secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>

                    <button className="btn" onClick={createCompany} disabled={loading}>
                        {loading ? "Creating..." : "Create Company"}
                    </button>
                </div>
            </div>
        </div>
    );
}
