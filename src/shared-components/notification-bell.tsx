import { useEffect, useState } from "react";
import { dataClient } from "../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import "../styles/notification.css";
import { useTaskModal } from "../pages/shared/stores/taskModalStore";

export default function NotificationBell() {
    const client = dataClient();
    const navigate = useNavigate();

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
                            action: n.link
                                ? {
                                    label: "Open",
                                    onClick: () => navigate(n.link),
                                }
                                : undefined,
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

        } catch (err) {
            console.error("notif init error", err);
        }
    }

    /* ===============================
       MARK ONE READ
    =============================== */
    async function markRead(n: any) {
        try {
            await client.models.Notification.update({
                id: n.id,
                isRead: true
            });

            if (n.link?.startsWith("/tasks/")) {
                const id = n.link.split("/tasks/")[1];
                openTask(id);
            } else if (n.link) {
                navigate(n.link);
            }

            setNotifications(prev =>
                prev.map(x =>
                    x.id === n.id ? { ...x, isRead: true } : x
                )
            );

        } catch (err) {
            console.error(err);
        }
    }


    /* ===============================
       MARK ALL READ (Slack style)
    =============================== */
    async function markAllRead() {
        try {
            const unread = notifications.filter(n => !n.isRead);
            if (unread.length === 0) return;

            await Promise.all(
                unread.map(n =>
                    client.models.Notification.update({
                        id: n.id,
                        isRead: true
                    })
                )
            );

            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
        } catch (err) {
            console.error(err);
        }
    }

    /* ===============================
       CLEAR BUTTON (same as mark all)
    =============================== */
    async function clearAll(e?: any) {
        e?.stopPropagation();
        await markAllRead();
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

                </div>
            )}
        </div>
    );
}
