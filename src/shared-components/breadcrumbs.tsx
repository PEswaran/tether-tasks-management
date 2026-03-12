import { useNavigate, useLocation } from "react-router-dom";
import { useWorkspace } from "./workspace-context";

export default function Breadcrumbs({ workspaces = [] }: any) {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useWorkspace();

    const workspaceName =
        workspaceId && workspaces.length
            ? workspaces.find((w: any) => w.id === workspaceId)?.name
            : null;

    function pageName() {
        if (location.pathname.includes("/members")) return "Members";
        if (location.pathname.includes("/tasks")) return "Organizations";
        return "Dashboard";
    }

    return (
        <div className="breadcrumb">
            <span className="crumb clickable" onClick={() => navigate("/app")}>
                Dashboard
            </span>

            {workspaceName && (
                <>
                    <span className="crumb-sep">/</span>
                    <span className="crumb workspace">{workspaceName}</span>
                </>
            )}

            {location.pathname !== "/app" && (
                <>
                    <span className="crumb-sep">/</span>
                    <span className="crumb current">{pageName()}</span>
                </>
            )}
        </div>
    );
}
