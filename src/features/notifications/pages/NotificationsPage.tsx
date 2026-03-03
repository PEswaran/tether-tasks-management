import { useEffect, useState } from "react";
import { dataClient } from "../../../libs/data-client";
import { getCurrentUser } from "aws-amplify/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { useWorkspace } from "../../../shared-components/workspace-context";
import { useTaskModal } from "../../../pages/shared/stores/taskModalStore";
import { resolveDestination } from "../../../libs/notificationHelpers";
import { CheckCheck } from "lucide-react";

type FilterTab = "all" | "unread" | "read";

export default function NotificationsPage() {
    const client = dataClient();
    const navigate = useNavigate();
    const location = useLocation();
    const { role } = useWorkspace();
    const openTask = useTaskModal((s) => s.openTask);

    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterTab>("all");

    useEffect(() => {
        loadNotifications();
    }, []);

    async function loadNotifications() {
        try {
            const user = await getCurrentUser();
            const sub = user.userId;

            const res = await client.models.Notification.listNotificationsByUser({
                recipientId: sub,
            });

            const sorted = (res.data || []).sort(
                (a: any, b: any) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setNotifications(sorted);
        } catch (err: any) {
            if (err?.name === "UserUnAuthenticatedException") return;
            console.error("Failed to load notifications:", err);
        } finally {
            setLoading(false);
        }
    }

    function handleClick(n: any) {
        // Mark as read
        if (!n.isRead) {
            setNotifications((prev) =>
                prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
            );
            client.models.Notification.update({ id: n.id, isRead: true }).catch(
                (err: any) => console.error("Failed to mark notification read:", err)
            );
        }

        // Navigate
        const dest = resolveDestination(n, role, location.pathname);
        if (dest) {
            if (dest.type === "task") {
                openTask(dest.id);
            } else {
                navigate(dest.path);
            }
        }
    }

    function markOneRead(e: React.MouseEvent, n: any) {
        e.stopPropagation();
        setNotifications((prev) =>
            prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
        client.models.Notification.update({ id: n.id, isRead: true }).catch(
            (err: any) => console.error("Failed to mark notification read:", err)
        );
    }

    function markAllRead() {
        const unread = notifications.filter((n) => !n.isRead);
        if (unread.length === 0) return;

        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

        Promise.all(
            unread.map((n) =>
                client.models.Notification.update({ id: n.id, isRead: true })
            )
        ).catch((err: any) =>
            console.error("Failed to mark all notifications read:", err)
        );
    }

    function formatType(type: string): string {
        switch (type) {
            case "TASK_ASSIGNED": return "Task Assigned";
            case "TASK_UPDATED": return "Task Updated";
            case "TASK_COMPLETED": return "Task Completed";
            case "TASK_DELETE_REQUEST": return "Delete Request";
            case "BOARD_ASSIGNED": return "Board Assigned";
            case "INVITED_TO_WORKSPACE": return "Invitation";
            case "CONTACT_REQUEST": return "Contact Request";
            default: return type || "Notification";
        }
    }

    function timeAgo(dateStr: string): string {
        const now = Date.now();
        const then = new Date(dateStr).getTime();
        const diff = now - then;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
        });
    }

    /* Filtered list */
    const filtered = notifications.filter((n) => {
        if (filter === "unread") return !n.isRead;
        if (filter === "read") return n.isRead;
        return true;
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    if (loading) {
        return (
            <div className="page">
                <h2>Loading notifications...</h2>
            </div>
        );
    }

    return (
        <div className="page">
            {/* HEADER */}
            <div className="page-header">
                <div>
                    <h1>Notifications</h1>
                    <div className="page-sub">
                        {unreadCount > 0
                            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                            : "You're all caught up"}
                    </div>
                </div>

                {unreadCount > 0 && (
                    <button className="btn-primary" onClick={markAllRead}>
                        <CheckCheck size={16} style={{ marginRight: 6 }} />
                        Mark all read
                    </button>
                )}
            </div>

            {/* FILTER TABS */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 20,
                }}
            >
                {(["all", "unread", "read"] as FilterTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        style={{
                            padding: "6px 16px",
                            borderRadius: 8,
                            border: filter === tab ? "1px solid #6366f1" : "1px solid #e2e8f0",
                            background: filter === tab ? "#eef2ff" : "#fff",
                            color: filter === tab ? "#6366f1" : "#64748b",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                            textTransform: "capitalize",
                        }}
                    >
                        {tab}
                        {tab === "unread" && unreadCount > 0 && (
                            <span
                                style={{
                                    marginLeft: 6,
                                    background: "#6366f1",
                                    color: "#fff",
                                    borderRadius: 10,
                                    padding: "1px 7px",
                                    fontSize: 11,
                                }}
                            >
                                {unreadCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* NOTIFICATION LIST */}
            {filtered.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
                    {filter === "unread"
                        ? "No unread notifications"
                        : filter === "read"
                            ? "No read notifications"
                            : "No notifications yet"}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filtered.map((n) => (
                        <div
                            key={n.id}
                            className="card"
                            onClick={() => handleClick(n)}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                padding: "16px 20px",
                                gap: 16,
                                cursor: "pointer",
                                borderLeft: !n.isRead ? "3px solid #6366f1" : "3px solid transparent",
                                background: !n.isRead ? "#fafaff" : "#fff",
                                transition: "background 0.15s",
                            }}
                        >
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
                                        {n.title}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                            background: "#f1f5f9",
                                            color: "#64748b",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {formatType(n.type)}
                                    </span>
                                </div>
                                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                                    {n.message}
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                                    {timeAgo(n.createdAt)}
                                </div>
                            </div>

                            {/* Mark read button */}
                            {!n.isRead && (
                                <button
                                    onClick={(e) => markOneRead(e, n)}
                                    title="Mark as read"
                                    style={{
                                        flexShrink: 0,
                                        background: "none",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 6,
                                        padding: "4px 10px",
                                        fontSize: 12,
                                        color: "#6366f1",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Mark read
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
