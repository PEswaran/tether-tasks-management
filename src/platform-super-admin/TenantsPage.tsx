import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { dataClient } from "../libs/data-client";
import CreateTenantModal from "./CreateTenantModal";

export default function TenantsPage() {
    const client = dataClient();
    const navigate = useNavigate();

    const [tenants, setTenants] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => { load(); }, []);

    async function load() {
        const res = await client.models.Tenant.list();
        setTenants(res.data);
    }

    return (
        <div>
            <div className="page-title">Companies</div>

            {/* 🔵 BUTTON */}
            <button
                className="btn"
                style={{ marginBottom: 20 }}
                onClick={() => setShowCreate(true)}
            >
                + Create Company
            </button>

            {/* 🔵 REAL MODAL */}
            {showCreate && (
                <CreateTenantModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        load();
                    }}
                />
            )}

            {/* 🔵 TABLE */}
            <table className="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>

                <tbody>
                    {tenants.map(t => (
                        <tr key={t.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/super/tenant/${t.id}`)}>
                            <td>{t.companyName}</td>
                            <td>{t.planType || "Free"}</td>
                            <td>{t.status || "Active"}</td>
                            <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
