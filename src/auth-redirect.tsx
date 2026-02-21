import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "./libs/data-client";

export default function AuthRedirect() {
    const navigate = useNavigate();
    const client = dataClient();

    useEffect(() => {
        async function routeUser() {
            try {
                const session = await fetchAuthSession();
                const payload: any = session.tokens?.idToken?.payload;

                if (!payload) {
                    navigate("/login");
                    return;
                }

                // platform super admin
                const groups: string[] = payload["cognito:groups"] || [];
                const normalizedGroups = groups.map((g) => g.toUpperCase());
                if (normalizedGroups.includes("PLATFORM_SUPER_ADMIN")) {
                    navigate("/super");
                    return;
                }

                const sub = payload.sub;

                // get memberships
                const res: any = await client.models.Membership.listMembershipsByUser({
                    userSub: sub
                });

                const memberships = res?.data || [];

                // helper: check for pending invitations
                async function hasPendingInvitation(): Promise<boolean> {
                    const userEmail = payload.email as string;
                    if (!userEmail) return false;
                    const invRes: any = await client.models.Invitation.listInvitesByEmail({
                        email: userEmail,
                    });
                    return (invRes?.data || []).some(
                        (i: any) => i.status === "PENDING"
                    );
                }

                async function acceptTenantAdminInviteIfNeeded(tenantId: string, workspaceId: string) {
                    const userEmail = payload.email as string;
                    if (!userEmail) return;

                    const invRes: any = await client.models.Invitation.listInvitesByEmail({
                        email: userEmail,
                    });

                    const pending = (invRes?.data || []).find(
                        (i: any) =>
                            i.status === "PENDING" &&
                            i.tenantId === tenantId &&
                            i.workspaceId === workspaceId
                    );

                    if (pending) {
                        await client.models.Invitation.update({
                            id: pending.id,
                            status: "ACCEPTED",
                        });
                    }
                }

                // no memberships at all — check for pending invitations first
                if (!memberships.length) {
                    if (await hasPendingInvitation()) {
                        navigate("/accept-org-invitation");
                    } else {
                        navigate("/no-access");
                    }
                    return;
                }

                // prefer last-used workspace, fall back to first membership
                let activeMem = memberships[0];
                const stored = localStorage.getItem("activeWorkspace");
                if (stored) {
                    const found = memberships.find((m: any) => m.workspaceId === stored);
                    if (found) activeMem = found;
                }

                const role = activeMem.role;

                // for OWNER/MEMBER users, check for pending invitations
                // (e.g. member in ws A, pending owner invite for ws B)
                if (role !== "TENANT_ADMIN" && await hasPendingInvitation()) {
                    navigate("/accept-org-invitation");
                    return;
                }

                // check if tenant is suspended
                const tenantRes = await client.models.Tenant.get({ id: activeMem.tenantId });
                if (tenantRes.data?.status === "SUSPENDED") {
                    navigate("/suspended");
                    return;
                }

                if (role === "TENANT_ADMIN") {
                    await acceptTenantAdminInviteIfNeeded(activeMem.tenantId, activeMem.workspaceId);
                    navigate("/tenant");
                } else if (role === "OWNER") {
                    navigate("/owner");
                } else {
                    navigate("/member");
                }

            } catch (err: any) {
                console.error("redirect error", err);
                const name = err?.name || "";
                if (
                    name === "UserUnAuthenticatedException" ||
                    name === "NoValidAuthTokens" ||
                    name === "TooManyRequestsException"
                ) {
                    navigate("/login");
                    return;
                }
                navigate("/no-access");
            }
        }

        routeUser();
    }, []);

    return <div style={{ padding: 40 }}>Loading...</div>;
}
