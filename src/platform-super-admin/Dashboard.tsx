import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";

export default function Dashboard() {
    const client = dataClient();
    const [stats, setStats] = useState<any>({
        tenants: 0,
        users: 0,
        tasks: 0
    });

    useEffect(() => { load(); }, []);

    async function load() {
        const tenants = await client.models.Tenant.list();
        const members = await client.models.Membership.list();
        const tasks = await client.models.Task.list();

        setStats({
            tenants: tenants.data.length,
            users: members.data.length,
            tasks: tasks.data.length
        });
    }

    return (
        <div>
            <div className="page-title">Platform Overview</div>

            <div className="card-grid">
                <div className="card">
                    <h3>Total Companies</h3>
                    <p>{stats.tenants}</p>
                </div>

                <div className="card">
                    <h3>Total Users</h3>
                    <p>{stats.users}</p>
                </div>

                <div className="card">
                    <h3>Total Tasks</h3>
                    <p>{stats.tasks}</p>
                </div>
            </div>
        </div>
    );
}
