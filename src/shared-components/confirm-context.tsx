import { createContext, useContext, useState, useCallback, useRef } from "react";

type Variant = "info" | "danger" | "warning" | "success";

interface ModalOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: Variant;
}

type ConfirmFn = (opts: string | ModalOptions) => Promise<boolean>;
type AlertFn = (opts: string | ModalOptions) => Promise<void>;

const ConfirmContext = createContext<{ confirm: ConfirmFn; alert: AlertFn } | null>(null);

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm must be inside ConfirmProvider");
    return ctx;
}

interface ModalState {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: Variant;
    isAlert: boolean;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [modal, setModal] = useState<ModalState | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm: ConfirmFn = useCallback((opts) => {
        const o = typeof opts === "string" ? { message: opts } : opts;
        setModal({
            title: o.title || "Confirm",
            message: o.message,
            confirmLabel: o.confirmLabel || "Confirm",
            cancelLabel: o.cancelLabel || "Cancel",
            variant: o.variant || "info",
            isAlert: false,
        });
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    const alertFn: AlertFn = useCallback((opts) => {
        const o = typeof opts === "string" ? { message: opts } : opts;
        setModal({
            title: o.title || "Notice",
            message: o.message,
            confirmLabel: o.confirmLabel || "OK",
            cancelLabel: "",
            variant: o.variant || "info",
            isAlert: true,
        });
        return new Promise<void>((resolve) => {
            resolveRef.current = () => resolve();
        });
    }, []);

    function handleConfirm() {
        resolveRef.current?.(true);
        resolveRef.current = null;
        setModal(null);
    }

    function handleCancel() {
        resolveRef.current?.(false);
        resolveRef.current = null;
        setModal(null);
    }

    const variantStyles: Record<Variant, { bg: string; color: string; iconBg: string; btnBg: string; btnHover: string }> = {
        info: { bg: "#eff6ff", color: "#3b82f6", iconBg: "#dbeafe", btnBg: "linear-gradient(135deg, #6366f1, #06b6d4)", btnHover: "rgba(99,102,241,0.25)" },
        danger: { bg: "#fef2f2", color: "#dc2626", iconBg: "#fee2e2", btnBg: "#dc2626", btnHover: "rgba(220,38,38,0.25)" },
        warning: { bg: "#fffbeb", color: "#d97706", iconBg: "#fef3c7", btnBg: "#d97706", btnHover: "rgba(217,119,6,0.25)" },
        success: { bg: "#ecfdf5", color: "#059669", iconBg: "#d1fae5", btnBg: "#059669", btnHover: "rgba(5,150,105,0.25)" },
    };

    return (
        <ConfirmContext.Provider value={{ confirm, alert: alertFn }}>
            {children}
            {modal && (
                <div
                    className="modal-backdrop"
                    onClick={modal.isAlert ? handleConfirm : handleCancel}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                            {/* Icon */}
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: variantStyles[modal.variant].iconBg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                marginTop: 2,
                            }}>
                                {modal.variant === "danger" && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={variantStyles[modal.variant].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                )}
                                {modal.variant === "warning" && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={variantStyles[modal.variant].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                )}
                                {modal.variant === "success" && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={variantStyles[modal.variant].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                )}
                                {modal.variant === "info" && (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={variantStyles[modal.variant].color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                    </svg>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
                                    {modal.title}
                                </h3>
                                <p style={{ margin: "8px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
                                    {modal.message}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 10,
                            marginTop: 24,
                            paddingTop: 16,
                            borderTop: "1px solid #f1f5f9",
                        }}>
                            {!modal.isAlert && (
                                <button
                                    className="btn secondary"
                                    onClick={handleCancel}
                                >
                                    {modal.cancelLabel}
                                </button>
                            )}
                            <button
                                className="btn"
                                style={{
                                    background: variantStyles[modal.variant].btnBg,
                                    borderColor: "transparent",
                                }}
                                onClick={handleConfirm}
                            >
                                {modal.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
