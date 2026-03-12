import { fetchAuthSession } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { INDUSTRY_TEMPLATES } from "../config/industryTemplates";

export async function createIndustryBoards(
    industry: "general" | "software" | "accounting",
    workspaceId: string,
    organizationId: string | null,
    tenantId: string
) {
    const client = dataClient();

    const session = await fetchAuthSession();
    const sub = session.tokens?.accessToken?.payload?.sub as string;

    const boards = INDUSTRY_TEMPLATES[industry];

    if (!boards) return;

    console.log("🏗 Creating industry boards:", industry);

    for (const board of boards) {

        const newBoard = await client.models.TaskBoard.create({
            tenantId,
            organizationId: organizationId || undefined,
            workspaceId,
            name: board.name,
            description: board.description,
            createdBy: sub,
            isActive: true,
            createdAt: new Date().toISOString(),
            boardType: "SYSTEM"
        });

        if (!newBoard.data?.id) continue;
        const boardId = newBoard.data.id;

        for (const task of board.tasks) {
            await client.models.Task.create({
                tenantId,
                organizationId: organizationId || undefined,
                workspaceId,
                taskBoardId: boardId,
                title: task.title,
                status: task.status,
                priority: task.priority,
                createdBy: sub,
                createdAt: new Date().toISOString(),
            });
        }
    }

    console.log("✅ Industry boards created");
}
