import { useEffect, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }: any) {
    const [loading, setLoading] = useState(true);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        check();
    }, []);

    async function check() {
        try {
            await getCurrentUser();
            setAuthed(true);
        } catch {
            setAuthed(false);
        }
        setLoading(false);
    }

    if (loading) return null;
    if (!authed) return <Navigate to="/no-access" />;

    return children;
}
