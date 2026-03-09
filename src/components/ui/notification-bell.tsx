import { useEffect, useState } from "react";
import { dataClient } from "../../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useTaskModal } from "../../pages/shared/stores/taskModalStore";
import { useWorkspace } from "../../shared-components/workspace-context";
import { resolveDestination as resolveDest, getRolePrefix } from "../../libs/notificationHelpers";

export default function NotificationBell() {
    const client = dataClient();
    const navigate = useNavigate();
    const location = useLocation();
    const { role } = useWorkspace();

    const [notifications, setNotifications] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [userSub, setUserSub] = useState<string>("");
    const openTask = useTaskModal((s) => s.openTask);


    useEffect(() => {
        init();
    }, []);

    /* ===============================
       INIT
    =============================== */
    async function init() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;
            setUserSub(sub);
            console.log(userSub);

            /* initial load */
            const res = await client.models.Notification.list({
                filter: { recipientId: { eq: sub } }
            });

            const sorted = (res.data || []).sort(
                (a: any, b: any) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
            );

            setNotifications(sorted);

            /* realtime new */
            const subCreate = client.models.Notification.onCreate().subscribe({
                next: (msg: any) => {
                    const n = msg?.data;
                    if (!n) return;

                    if (n.recipientId === sub) {
                        setNotifications(prev => [n, ...prev]);

                        toast.success(n.title || "New notification", {
                            description: n.message,
                            action: {
                                label: "Open",
                                onClick: () => markRead(n),
                            },
                        });
                    }
                },
                error: (err) => console.error(err)
            });

            /* realtime update */
            const subUpdate = client.models.Notification.onUpdate().subscribe({
                next: (msg: any) => {
                    const updated = msg?.data;
                    if (!updated) return;

                    setNotifications(prev =>
                        prev.map(n => (n.id === updated.id ? updated : n))
                    );
                },
                error: (err) => console.error(err)
            });

            return () => {
                subCreate.unsubscribe();
                subUpdate.unsubscribe();
            };

        } catch (err: any) {
            if (err?.name === "UserUnAuthenticatedException") return;
            console.error("notif init error", err);
        }
    }

    /* ===============================
       RESOLVE DESTINATION FOR NOTIFICATION
    =============================== */
    function resolveDestination(n: any) {
        return resolveDest(n, role, location.pathname);
    }

    /* ===============================
       MARK ONE READ
    =============================== */
    function markRead(n: any) {
        // Update local state immediately so the notification disappears
        setNotifications(prev =>
            prev.map(x =>
                x.id === n.id ? { ...x, isRead: true } : x
            )
        );

        // Close the panel
        setOpen(false);

        // Navigate based on notification type
        const dest = resolveDestination(n);
        if (dest) {
            if (dest.type === "task") {
                openTask(dest.id);
            } else {
                navigate(dest.path);
            }
        }

        // Persist to DB in the background
        client.models.Notification.update({
            id: n.id,
            isRead: true
        }).catch((err: any) => console.error("Failed to mark notification read:", err));
    }


    /* ===============================
       MARK ALL READ (Slack style)
    =============================== */
    function markAllRead() {
        const unread = notifications.filter(n => !n.isRead);
        if (unread.length === 0) return;

        // Update local state immediately
        setNotifications(prev =>
            prev.map(n => ({ ...n, isRead: true }))
        );

        // Persist to DB in the background
        Promise.all(
            unread.map(n =>
                client.models.Notification.update({
                    id: n.id,
                    isRead: true
                })
            )
        ).catch((err: any) => console.error("Failed to mark all notifications read:", err));
    }

    /* ===============================
       CLEAR BUTTON (same as mark all)
    =============================== */
    function clearAll(e?: any) {
        e?.stopPropagation();
        markAllRead();
        toast.success("All caught up 🎉");
    }

    /* ===============================
       TOGGLE BELL
    =============================== */
    async function toggleBell() {
        setOpen(!open);

    }

    const unread = notifications.filter(n => !n.isRead);
    const unreadCount = unread.length;

    return (
        <div className="notif-wrapper">

            {/* 🔔 BELL */}
            <div className="notif-bell" onClick={toggleBell}>
                🔔
                {unreadCount > 0 && (
                    <div className="notif-badge">{unreadCount}</div>
                )}
            </div>

            {/* PANEL */}
            {open && (
                <div className="notif-panel">

                    <div className="notif-header">
                        <span>Notifications</span>

                        {unreadCount > 0 && (
                            <button className="notif-clear" onClick={clearAll}>
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* EMPTY */}
                    {unreadCount === 0 && (
                        <div className="notif-empty">
                            You're all caught up 🎉
                        </div>
                    )}

                    {/* UNREAD ONLY */}
                    {unread.map(n => (
                        <div
                            key={n.id}
                            className="notif-item unread"
                            onClick={() => markRead(n)}
                        >
                            <div className="notif-title">{n.title}</div>
                            <div className="notif-msg">{n.message}</div>
                            <div className="notif-time">
                                {new Date(n.createdAt).toLocaleString()}
                            </div>
                        </div>
                    ))}

                    {/* VIEW ALL LINK */}
                    <div
                        style={{
                            padding: "10px 16px",
                            textAlign: "center",
                            borderTop: "1px solid #f1f5f9",
                        }}
                    >
                        <span
                            onClick={() => {
                                setOpen(false);
                                const prefix = getRolePrefix(role, location.pathname);
                                navigate(`${prefix}/notifications`);
                            }}
                            style={{
                                color: "#1e3a5f",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            View all notifications
                        </span>
                    </div>

                </div>
            )}
        </div>
    );
}
