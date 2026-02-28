import type { Schema } from "../../data/resource";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { env } from "$amplify/env/deleteOrganization";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env as any);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

async function listAll<T>(
    listFn: (args: any) => Promise<{ data: T[]; nextToken?: string | null }>,
    args: Record<string, any>
): Promise<T[]> {
    const all: T[] = [];
    let nextToken: string | null | undefined = undefined;
    do {
        const res = await listFn({ ...args, nextToken });
        all.push(...res.data);
        nextToken = (res as any).nextToken ?? null;
    } while (nextToken);
    return all;
}

export const handler: Schema["removeOrganizationAndData"]["functionHandler"] = async (event) => {
    const { organizationId } = event.arguments;
    if (!organizationId) {
        return { success: false, message: "Missing organizationId" };
    }

    try {
        const workspaces = await listAll(
            (args) => client.models.Workspace.list(args),
            { filter: { organizationId: { eq: organizationId } } }
        );
        const workspaceIds = new Set((workspaces as any[]).map((w) => w.id).filter(Boolean));

        const [boards, tasks, invites, memberships, notifications, auditLogs] = await Promise.all([
            listAll((args) => client.models.TaskBoard.list(args), { filter: { organizationId: { eq: organizationId } } }),
            listAll((args) => client.models.Task.list(args), { filter: { organizationId: { eq: organizationId } } }),
            listAll((args) => client.models.Invitation.list(args), { filter: { organizationId: { eq: organizationId } } }),
            listAll((args) => client.models.Membership.list(args), { filter: { organizationId: { eq: organizationId } } }),
            listAll((args) => client.models.Notification.list(args), { filter: { organizationId: { eq: organizationId } } }),
            listAll((args) => client.models.AuditLog.list(args), { filter: { organizationId: { eq: organizationId } } }),
        ]);

        const workspaceTasks = await Promise.all(
            Array.from(workspaceIds).map((workspaceId) =>
                listAll((args) => client.models.Task.list(args), { filter: { workspaceId: { eq: workspaceId } } })
            )
        );
        const workspaceBoards = await Promise.all(
            Array.from(workspaceIds).map((workspaceId) =>
                listAll((args) => client.models.TaskBoard.list(args), { filter: { workspaceId: { eq: workspaceId } } })
            )
        );

        const taskMap = new Map<string, any>();
        [...tasks, ...workspaceTasks.flat()].forEach((t: any) => {
            if (t?.id) taskMap.set(t.id, t);
        });
        for (const task of taskMap.values()) {
            await client.models.Task.delete({ id: task.id });
        }

        const boardMap = new Map<string, any>();
        [...boards, ...workspaceBoards.flat()].forEach((b: any) => {
            if (b?.id) boardMap.set(b.id, b);
        });
        for (const board of boardMap.values()) {
            await client.models.TaskBoard.delete({ id: board.id });
        }

        for (const invite of invites as any[]) {
            await client.models.Invitation.delete({ id: invite.id });
        }
        for (const member of memberships as any[]) {
            await client.models.Membership.delete({ id: member.id });
        }
        for (const notification of notifications as any[]) {
            await client.models.Notification.delete({ id: notification.id });
        }
        for (const log of auditLogs as any[]) {
            await client.models.AuditLog.delete({ id: log.id });
        }

        for (const workspace of workspaces as any[]) {
            await client.models.Workspace.delete({ id: workspace.id });
        }

        await client.models.Organization.delete({ id: organizationId });

        return {
            success: true,
            message: "Organization and related data deleted successfully.",
        };
    } catch (err: any) {
        console.error("deleteOrganization error:", err);
        return {
            success: false,
            message: err?.message || "Failed to delete organization data",
        };
    }
};
