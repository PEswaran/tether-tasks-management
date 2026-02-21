import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { displayName } from "../../../libs/displayName";

export default function AuditLogsPage() {
    const client = dataClient();
    const { tenantId } = useWorkspace();
    const [logs, setLogs] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, [tenantId]);

    async function load() {
        if (!tenantId) { setLoading(false); return; }

        const [res, profRes] = await Promise.all([
            client.models.AuditLog.list({ filter: { tenantId: { eq: tenantId } } }),
            client.models.UserProfile.list({ filter: { tenantId: { eq: tenantId } } }),
        ]);

        setProfiles(profRes.data);

        // sort by timestamp descending (most recent first)
        const sorted = [...res.data].sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(sorted);
        setLoading(false);
    }

    function profileEmail(userSub: string) {
        return profiles.find((p) => p.userId === userSub)?.email || userSub || "—";
    }

    if (loading) return <div>Loading audit logs...</div>;

    return (
        <div>
            <div className="page-title">Audit Logs</div>

            <table className="table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Resource Type</th>
                        <th>Resource ID</th>
                        <th>Result</th>
                    </tr>
                </thead>

                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id}>
                            <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                            <td>{log.userId ? displayName(profileEmail(log.userId)) : "—"}</td>
                            <td>
                                <span className={`status-badge ${log.action?.toLowerCase()}`}>
                                    {log.action}
                                </span>
                            </td>
                            <td>{log.resourceType || "—"}</td>
                            <td style={{ fontSize: 12, fontFamily: "monospace", color: "#64748b" }}>
                                {log.resourceId ? log.resourceId.substring(0, 12) + "..." : "—"}
                            </td>
                            <td>
                                <span style={{
                                    color: log.result === "SUCCESS" ? "#059669" : log.result === "FAILURE" ? "#dc2626" : "#64748b",
                                    fontWeight: 500, fontSize: 13,
                                }}>
                                    {log.result}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>
                                No audit logs recorded yet. Actions across your organization will appear here.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
