import { useEffect, useMemo, useState, useCallback } from "react";
import { dataClient } from "../libs/data-client";

type UseTasksProps = {
    workspaceId?: string | null;
    tenantId?: string | null;
};

export function useTasks({ workspaceId, tenantId }: UseTasksProps) {
    const client = useMemo(() => dataClient(), []);

    const [boards, setBoards] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    /* =========================================================
       MAIN LOAD
    ========================================================= */

    const load = useCallback(async () => {
        if (!tenantId) return;

        setLoading(true);

        try {
            const workspaceFilter = workspaceId
                ? { workspaceId: { eq: workspaceId } }
                : undefined;

            /* ===============================
               LOAD EVERYTHING IN PARALLEL
            =============================== */
            const [
                orgRes,
                boardRes,
                taskRes,
                profRes,
                memRes,
            ] = await Promise.all([
                client.models.Workspace.list({
                    filter: { tenantId: { eq: tenantId } },
                }),

                client.models.TaskBoard.list({
                    filter: workspaceFilter
                        ? { ...workspaceFilter }
                        : { tenantId: { eq: tenantId } },
                }),

                client.models.Task.list({
                    filter: workspaceFilter
                        ? { ...workspaceFilter }
                        : { tenantId: { eq: tenantId } },
                }),

                client.models.UserProfile.list({
                    filter: { tenantId: { eq: tenantId } },
                }),

                client.models.Membership.list({
                    filter: workspaceId
                        ? {
                            workspaceId: { eq: workspaceId },
                            status: { eq: "ACTIVE" },
                        }
                        : {
                            tenantId: { eq: tenantId },
                            status: { eq: "ACTIVE" },
                        },
                }),
            ]);

            const orgs = orgRes.data || [];
            const boardsData = boardRes.data || [];
            const tasksData = taskRes.data || [];
            let profilesData = profRes.data || [];
            const memberships = memRes.data || [];

            setOrganizations(orgs);
            setBoards(boardsData);

            if (profilesData.length === 0 && memberships.length > 0) {
                const uniqueUserSubs = [...new Set(memberships.map((m: any) => m.userSub).filter(Boolean))];
                const fetched = await Promise.all(
                    uniqueUserSubs.map(async (userSub: string) => {
                        try {
                            const res: any = await client.models.UserProfile.get({ userId: userSub });
                            return res?.data || null;
                        } catch {
                            return null;
                        }
                    })
                );
                profilesData = fetched.filter(Boolean) as any[];
            }

            setProfiles(profilesData);

            /* ===============================
               JOIN MEMBERSHIP + PROFILE
            =============================== */
            const enrichedMembers = memberships.map((m: any) => {
                const profile = profilesData.find(
                    (p: any) => p.userId === m.userSub
                );

                return {
                    userSub: m.userSub,
                    workspaceId: m.workspaceId,
                    tenantId: m.tenantId,
                    role: m.role,
                    email: profile?.email || m.userSub,
                    firstName: profile?.firstName,
                    lastName: profile?.lastName,
                };
            });

            setMembers(enrichedMembers);

            /* ===============================
               ENRICH TASKS
            =============================== */
            const enrichedTasks = tasksData.map((t: any) => {
                const profile = profilesData.find(
                    (p: any) => p.userId === t.createdBy
                );

                return {
                    ...t,
                    _createdByEmail: profile?.email || t.createdBy,
                };
            });

            setTasks(enrichedTasks);

        } catch (err: any) {
            if (err?.name === "NoValidAuthTokens") return;
            console.error("useTasks load error", err);
        } finally {
            setLoading(false);
        }
    }, [tenantId, workspaceId, client]);

    /* =========================================================
       INITIAL LOAD
    ========================================================= */

    useEffect(() => {
        load();
    }, [load]);

    /* =========================================================
       REALTIME TASK SUBSCRIPTIONS
    ========================================================= */

    useEffect(() => {
        if (!tenantId) return;

        let subCreate: any;
        let subUpdate: any;
        let subDelete: any;

        try {
            subCreate = client.models.Task.onCreate().subscribe({
                next: (task: any) => {
                    if (workspaceId && task.workspaceId !== workspaceId) return;
                    setTasks(prev => [...prev, task]);
                },
                error: () => { },
            });

            subUpdate = client.models.Task.onUpdate().subscribe({
                next: (task: any) => {
                    if (workspaceId && task.workspaceId !== workspaceId) return;

                    setTasks(prev =>
                        prev.map(t => (t.id === task.id ? task : t))
                    );
                },
                error: () => { },
            });

            subDelete = client.models.Task.onDelete().subscribe({
                next: (task: any) => {
                    setTasks(prev => prev.filter(t => t.id !== task.id));
                },
                error: () => { },
            });

        } catch (err) {
            console.warn("subscriptions skipped (likely logged out)");
        }

        return () => {
            subCreate?.unsubscribe();
            subUpdate?.unsubscribe();
            subDelete?.unsubscribe();
        };
    }, [tenantId, workspaceId]);

    /* =========================================================
       RETURN
    ========================================================= */

    return {
        boards,
        tasks,
        members,        // 🔥 correct workspace members
        profiles,
        organizations,
        reload: load,
        loading,
    };
}
