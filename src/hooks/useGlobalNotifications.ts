import { useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { dataClient } from "../libs/data-client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function useGlobalNotifications() {
    const client = dataClient();
    const navigate = useNavigate();

    useEffect(() => {
        let sub: string | null = null;

        async function init() {
            try {
                const user = await getCurrentUser();
                sub = user.userId;

                client.models.Notification.onCreate().subscribe({
                    next: (msg: any) => {
                        const n = msg?.data;
                        if (!n) return;

                        if (n.recipientId === sub) {
                            console.log("🔥 realtime notification", n);

                            toast.success(n.title || "New notification", {
                                description: n.message,
                                action: n.link
                                    ? {
                                        label: "Open",
                                        onClick: () => navigate(n.link),
                                    }
                                    : undefined,
                            });
                        }
                    },
                    error: (err) => console.error("notif sub error", err),
                });
            } catch (err) {
                console.error("notif init error", err);
            }
        }

        init();
    }, []);
}
