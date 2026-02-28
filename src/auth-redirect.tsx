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

                async function acceptTenantAdminInviteIfNeeded(tenantId: string, organizationId: string | undefined) {
                    const userEmail = payload.email as string;
                    if (!userEmail) return;

                    const invRes: any = await client.models.Invitation.listInvitesByEmail({
                        email: userEmail,
                    });

                    const pending = (invRes?.data || []).find(
                        (i: any) =>
                            i.status === "PENDING" &&
                            i.tenantId === tenantId &&
                            i.organizationId === organizationId
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
                const storedOrg = localStorage.getItem("activeOrganization");
                if (storedOrg) {
                    const found = memberships.find((m: any) => m.organizationId === storedOrg);
                    if (found) activeMem = found;
                }

                const role = activeMem.role;

                // Do not force users with active memberships into invitation flows.
                // Pending invites can be accepted from explicit invite links/pages.

                // check if tenant is suspended
                const tenantRes = await client.models.Tenant.get({ id: activeMem.tenantId });
                if (tenantRes.data?.status === "SUSPENDED") {
                    navigate("/suspended");
                    return;
                }

                const activeNonAdminMemberships = memberships.filter(
                    (m: any) => m.status === "ACTIVE" && m.role !== "TENANT_ADMIN"
                );
                const accessibleWorkspaceIds = new Set<string>();
                const orgIdsToExpand = new Set<string>();
                const tenantIdsToExpand = new Set<string>();

                activeNonAdminMemberships.forEach((m: any) => {
                    if (m.workspaceId) {
                        accessibleWorkspaceIds.add(m.workspaceId);
                        return;
                    }
                    if (m.organizationId) {
                        orgIdsToExpand.add(m.organizationId);
                        return;
                    }
                    if (m.tenantId) {
                        tenantIdsToExpand.add(m.tenantId);
                    }
                });

                const [orgWorkspaceResults, tenantWorkspaceResults] = await Promise.all([
                    Promise.all(
                        Array.from(orgIdsToExpand).map((orgId) =>
                            client.models.Workspace.list({ filter: { organizationId: { eq: orgId } } })
                        )
                    ),
                    Promise.all(
                        Array.from(tenantIdsToExpand).map((tid) =>
                            client.models.Workspace.list({ filter: { tenantId: { eq: tid } } })
                        )
                    ),
                ]);

                orgWorkspaceResults.forEach((res: any) => {
                    (res.data || [])
                        .filter((ws: any) => ws?.isActive !== false)
                        .forEach((ws: any) => {
                            if (ws?.id) accessibleWorkspaceIds.add(ws.id);
                        });
                });

                tenantWorkspaceResults.forEach((res: any) => {
                    (res.data || [])
                        .filter((ws: any) => ws?.isActive !== false)
                        .forEach((ws: any) => {
                            if (ws?.id) accessibleWorkspaceIds.add(ws.id);
                        });
                });

                const isMultiWorkspaceUser = role !== "TENANT_ADMIN" && accessibleWorkspaceIds.size > 1;

                if (isMultiWorkspaceUser) {
                    navigate("/general");
                    return;
                }

                if (role === "TENANT_ADMIN") {
                    await acceptTenantAdminInviteIfNeeded(activeMem.tenantId, activeMem.organizationId);
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
