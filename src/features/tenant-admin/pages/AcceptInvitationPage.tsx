import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../../../libs/data-client";
import { useNavigate } from "react-router-dom";
import { useConfirm } from "../../../shared-components/confirm-context";

export default function AcceptInvitationPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const { alert } = useConfirm();

    const [loading, setLoading] = useState(false);
    const [invite, setInvite] = useState<any>(null);

    useEffect(() => {
        loadInvite();
    }, []);

    async function loadInvite() {
        const session = await fetchAuthSession();
        const email = session.tokens?.idToken?.payload?.email as string | undefined;

        if (!email) return;

        const res = await client.models.Invitation.list({
            filter: {
                email: { eq: email },
                status: { eq: "PENDING" }
            }
        });

        const pending = res.data?.[0];
        console.log("Pending invite:", pending);

        if (!pending) {
            navigate("/tenant");
            return;
        }

        setInvite(pending);
    }

    async function acceptInvite() {
        if (!invite) return;

        setLoading(true);

        try {
            const session = await fetchAuthSession();
            const userSub = session.tokens?.accessToken?.payload?.sub as string;

            if (!userSub) throw new Error("No userSub");

            // 🔵 mark invitation accepted
            await client.models.Invitation.update({
                id: invite.id,
                status: "ACCEPTED"
            });

            // 🔵 ensure membership exists
            const memCheck = await client.models.Membership.list({
                filter: {
                    workspaceId: { eq: invite.workspaceId },
                    userSub: { eq: userSub }
                }
            });

            if (!memCheck.data.length) {
                await client.models.Membership.create({
                    tenantId: invite.tenantId,
                    workspaceId: invite.workspaceId,
                    userSub,
                    role: invite.role,
                    status: "ACTIVE",
                    joinedAt: new Date().toISOString(),
                });
            }

            // 🚀 IMPORTANT: go to tenant dashboard
            navigate("/tenant");

        } catch (err) {
            console.error(err);
            await alert({ title: "Error", message: "Error accepting invite", variant: "danger" });
        }

        setLoading(false);
    }

    if (!invite) return <div>Loading invitation...</div>;

    return (
        <div style={{ padding: 40 }}>
            <h2>You're invited to join</h2>
            <p>Workspace access has been granted.</p>

            <button
                onClick={acceptInvite}
                disabled={loading}
                className="btn"
            >
                {loading ? "Accepting..." : "Accept & Continue"}
            </button>
        </div>
    );
}
