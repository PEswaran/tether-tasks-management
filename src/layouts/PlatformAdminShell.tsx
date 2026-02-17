import { platformNav } from "../config/nav";
import AppShell from "./AppShell";

export default function PlatformShell() {
    return (
        <AppShell
            companyName="Platform Admin"
            navItems={platformNav}
        />
    );
}
