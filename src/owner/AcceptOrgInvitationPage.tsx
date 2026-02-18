import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { useWorkspace } from "../shared-components/workspace-context";
import "../platform-super-admin/styles/platform-admin.css";
import { useConfirm } from "../shared-components/confirm-context";

export default function AcceptOrgInvitationPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const { refreshSession, refreshWorkspaces } = useWorkspace();
    const { alert } = useConfirm();

    const [invitation, setInvitation] = useState<any>(null);
    const [tenantName, setTenantName] = useState("");
    const [orgName, setOrgName] = useState("");
    const [inviterName, setInviterName] = useState("");
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => { loadInvitation(); }, []);

    async function loadInvitation() {
        try {
            const session = await fetchAuthSession();
            const email = session.tokens?.idToken?.payload?.email as string;
            if (!email) { navigate("/no-access"); return; }

            const res = await client.models.Invitation.listInvitesByEmail({
                email,
            });

            // find OWNER or MEMBER pending invitation
            const inv = (res.data || []).find(
                (i: any) => i.status === "PENDING" && (i.role === "OWNER" || i.role === "MEMBER")
            );

            if (!inv) { navigate("/"); return; }

            setInvitation(inv);

            // load tenant and org names
            const [tenantRes, orgRes] = await Promise.all([
                inv.tenantId ? client.models.Tenant.get({ id: inv.tenantId }) : null,
                inv.workspaceId ? client.models.Workspace.get({ id: inv.workspaceId }) : null,
            ]);

            setTenantName(tenantRes?.data?.companyName || "");
            setOrgName(orgRes?.data?.name || "");

            // resolve inviter name
            if (inv.invitedBy) {
                try {
                    const profRes = await client.models.UserProfile.get({ userId: inv.invitedBy });
                    if (profRes?.data) {
                        const p = profRes.data;
                        const name = `${p.firstName || ""} ${p.lastName || ""}`.trim();
                        setInviterName(name || p.email || inv.invitedBy);
                    }
                } catch { /* ignore */ }
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }

    async function acceptInvitation() {
        if (!invitation) return;
        setAccepting(true);

        try {
            const session = await fetchAuthSession();
            const userSub = session.tokens?.accessToken?.payload?.sub as string;
            if (!userSub) throw new Error("No userSub");

            // Mark invitation as accepted
            await client.models.Invitation.update({
                id: invitation.id,
                status: "ACCEPTED",
            });

            // Create membership if it doesn't already exist
            const memCheck = await client.models.Membership.listMembershipsByWorkspace({
                workspaceId: invitation.workspaceId,
            });
            const alreadyMember = memCheck.data.some(
                (m: any) => m.userSub === userSub
            );

            if (!alreadyMember) {
                await client.models.Membership.create({
                    tenantId: invitation.tenantId,
                    workspaceId: invitation.workspaceId,
                    userSub,
                    role: invitation.role,
                    status: "ACTIVE",
                    joinedAt: new Date().toISOString(),
                });
            }

            // refresh context so new membership + workspace appear immediately
            await refreshSession();
            await refreshWorkspaces();

            // route to the correct shell
            navigate("/");
        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error accepting invitation", variant: "danger" });
            setAccepting(false);
        }
    }

    if (loading) return <div style={styles.wrapper}>Loading...</div>;
    if (!invitation) return null;

    const roleName = invitation.role === "OWNER" ? "Owner" : "Member";

    return (
        <div style={styles.wrapper}>
            <div style={styles.card}>
                <h2 style={styles.heading}>You've Been Invited</h2>

                <p style={styles.detail}>
                    You have been invited to join
                    {orgName ? <strong> {orgName} </strong> : " an organization "}
                    {tenantName ? <>at <strong>{tenantName}</strong></> : ""}
                    {" "}as a <strong>{roleName}</strong>.
                </p>

                {inviterName && (
                    <p style={styles.detail}>
                        Invited by <strong>{inviterName}</strong>
                    </p>
                )}

                <p style={styles.meta}>
                    Invited on {new Date(invitation.createdAt).toLocaleDateString()}
                    {" · "}
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>

                <div style={styles.actions}>
                    <button className="btn" onClick={acceptInvitation} disabled={accepting}>
                        {accepting ? "Accepting..." : "Accept Invitation"}
                    </button>
                    <button
                        className="btn secondary"
                        style={{ marginLeft: 10 }}
                        onClick={async () => { await signOut(); navigate("/"); }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "#f7f8fb", fontFamily: "Inter, system-ui, Arial",
    },
    card: {
        background: "white", padding: 40, borderRadius: 14, width: 460,
        boxShadow: "0 20px 60px rgba(0,0,0,0.12)", textAlign: "center",
    },
    heading: { fontSize: 24, fontWeight: 600, color: "#0f172a", marginBottom: 16 },
    detail: { fontSize: 16, color: "#334155", lineHeight: 1.6, marginBottom: 12 },
    meta: { fontSize: 13, color: "#94a3b8", marginBottom: 28 },
    actions: { marginTop: 8 },
};
