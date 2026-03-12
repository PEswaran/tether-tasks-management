import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import CreateTaskBoardModal from "../../../components/shared/modals/create-task-board-modal";

export default function WorkspaceTemplates() {
  const client = dataClient();
  const [boards, setBoards] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);


  async function loadTemplates() {
    const res = await client.models.TaskBoard.list({
      filter: { isTemplate: { eq: true } }
    });
    setBoards(res.data);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Template Manager</h1>
      <div style={{ color: "#64748b", marginTop: 6 }}>
        Create and manage organization templates for all tenants.
      </div>

      <div style={{ marginTop: 24 }}>
        {boards.length === 0 && (
          <div style={{ color: "#94a3b8" }}>
            No templates created yet.
          </div>
        )}
        <button className="btn" onClick={() => setShowCreate(true)}>
          + Create Template Board
        </button>


        {boards.map(b => (
          <div key={b.id} style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #eef2f7",
            marginBottom: 10,
            background: "#fff"
          }}>
            <div style={{ fontWeight: 600 }}>{b.name}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Category: {b.templateCategory || "none"}
            </div>
          </div>
        ))}
        {showCreate && (
          <CreateTaskBoardModal
            workspaces={[]}
            tenantId={'YOUR_TENANT_ID'}
            templateMode={true}
            forcedWorkspaceId={"TEMPLATES_WORKSPACE_ID"}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              loadTemplates();
            }}
          />
        )}

      </div>
    </div>
  );
}
