import { Routes, Route } from "react-router-dom";
import SuperAdminShell from "../layouts/PlatformAdminShell";
import AuthRedirect from "../auth-redirect";

export default function AppRoutes() {
    return (
        <Routes>

            {/* after login landing */}
            <Route path="/" element={<AuthRedirect />} />

            {/* super admin */}
            <Route path="/super/*" element={<SuperAdminShell />} />

            {/* tenant admin 
            <Route path="/tenant/*" element={<TenantAdminShell />} />*/}

            {/* members 
            <Route path="/app/*" element={<MemberShell />} />*/}

        </Routes>
    );
}
