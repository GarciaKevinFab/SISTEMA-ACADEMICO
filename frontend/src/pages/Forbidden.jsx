import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Forbidden() {
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const [seconds, setSeconds] = useState(15);

    useEffect(() => {
        requestAnimationFrame(() => setMounted(true));
    }, []);

    useEffect(() => {
        if (seconds <= 0) {
            navigate("/dashboard");
            return;
        }
        const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [seconds, navigate]);

    return (
        <div style={styles.wrapper}>
            {/* Background pattern */}
            <div style={styles.gridBg} />
            <div style={styles.noiseOverlay} />

            {/* Floating geometric shapes */}
            <div
                style={{
                    ...styles.floatingShape,
                    ...styles.shape1,
                    opacity: mounted ? 0.08 : 0,
                    transform: mounted ? "rotate(45deg) scale(1)" : "rotate(45deg) scale(0.5)",
                }}
            />
            <div
                style={{
                    ...styles.floatingShape,
                    ...styles.shape2,
                    opacity: mounted ? 0.06 : 0,
                    transform: mounted ? "rotate(12deg) scale(1)" : "rotate(12deg) scale(0.5)",
                }}
            />
            <div
                style={{
                    ...styles.floatingShape,
                    ...styles.shape3,
                    opacity: mounted ? 0.05 : 0,
                    transform: mounted ? "rotate(-20deg) scale(1)" : "rotate(-20deg) scale(0.5)",
                }}
            />

            {/* Main content */}
            <div
                style={{
                    ...styles.content,
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(30px)",
                }}
            >
                {/* Lock icon */}
                <div style={styles.lockContainer}>
                    <div
                        style={{
                            ...styles.lockRing,
                            ...(mounted ? styles.lockRingAnimated : {}),
                        }}
                    >
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={styles.lockIcon}
                        >
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            <circle cx="12" cy="16" r="1" />
                        </svg>
                    </div>
                </div>

                {/* Error code */}
                <div style={styles.errorCodeWrapper}>
                    <span
                        style={{
                            ...styles.errorCode,
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? "translateY(0)" : "translateY(20px)",
                            transitionDelay: "0.2s",
                        }}
                    >
                        403
                    </span>
                    <div
                        style={{
                            ...styles.errorLine,
                            width: mounted ? "100%" : "0%",
                            transitionDelay: "0.5s",
                        }}
                    />
                </div>

                {/* Message */}
                <h1
                    style={{
                        ...styles.title,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(15px)",
                        transitionDelay: "0.35s",
                    }}
                >
                    Acceso restringido
                </h1>
                <p
                    style={{
                        ...styles.subtitle,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(15px)",
                        transitionDelay: "0.45s",
                    }}
                >
                    No cuentas con los permisos necesarios para acceder a esta sección.
                    <br />
                    Si crees que es un error, contacta al administrador del sistema.
                </p>

                {/* Actions */}
                <div
                    style={{
                        ...styles.actions,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(15px)",
                        transitionDelay: "0.55s",
                    }}
                >
                    <button
                        onClick={() => navigate("/dashboard")}
                        style={styles.primaryBtn}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#1d2939";
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.18)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#0f172a";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.1)";
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                        >
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Ir al inicio
                    </button>

                    <button
                        onClick={() => navigate(-1)}
                        style={styles.secondaryBtn}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f1f5f9";
                            e.currentTarget.style.borderColor = "#94a3b8";
                            e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "#cbd5e1";
                            e.currentTarget.style.transform = "translateY(0)";
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ flexShrink: 0 }}
                        >
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Volver atrás
                    </button>
                </div>

                {/* Redirect timer */}
                <p
                    style={{
                        ...styles.timer,
                        opacity: mounted ? 1 : 0,
                        transitionDelay: "0.7s",
                    }}
                >
                    Redirigiendo al inicio en{" "}
                    <span style={styles.timerCount}>{seconds}s</span>
                </p>
            </div>

            {/* Bottom decorative bar */}
            <div
                style={{
                    ...styles.bottomBar,
                    width: mounted ? "100%" : "0%",
                }}
            />

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.25); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        @keyframes float-slow {
          0%, 100% { transform: rotate(45deg) translateY(0px); }
          50% { transform: rotate(45deg) translateY(-20px); }
        }

        @keyframes float-slow-2 {
          0%, 100% { transform: rotate(12deg) translateY(0px); }
          50% { transform: rotate(12deg) translateY(15px); }
        }

        @keyframes float-slow-3 {
          0%, 100% { transform: rotate(-20deg) translateX(0px); }
          50% { transform: rotate(-20deg) translateX(-15px); }
        }
      `}</style>
        </div>
    );
}

const styles = {
    wrapper: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(160deg, #fafbff 0%, #f0f4ff 30%, #fef2f2 70%, #fff8f0 100%)",
        fontFamily: "'DM Sans', sans-serif",
    },
    gridBg: {
        position: "absolute",
        inset: 0,
        backgroundImage:
            "linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
    },
    noiseOverlay: {
        position: "absolute",
        inset: 0,
        opacity: 0.3,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        pointerEvents: "none",
    },
    floatingShape: {
        position: "absolute",
        borderRadius: "20px",
        border: "2px solid #ef4444",
        transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: "none",
    },
    shape1: {
        width: "200px",
        height: "200px",
        top: "8%",
        right: "12%",
        animation: "float-slow 8s ease-in-out infinite",
    },
    shape2: {
        width: "140px",
        height: "140px",
        bottom: "15%",
        left: "8%",
        borderRadius: "50%",
        animation: "float-slow-2 10s ease-in-out infinite",
    },
    shape3: {
        width: "100px",
        height: "100px",
        top: "60%",
        right: "5%",
        animation: "float-slow-3 7s ease-in-out infinite",
    },
    content: {
        position: "relative",
        zIndex: 10,
        textAlign: "center",
        maxWidth: "480px",
        padding: "0 24px",
        transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    lockContainer: {
        display: "flex",
        justifyContent: "center",
        marginBottom: "32px",
    },
    lockRing: {
        width: "96px",
        height: "96px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
        border: "2px solid #fecaca",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.6s ease",
    },
    lockRingAnimated: {
        animation: "pulse-ring 2.5s ease-in-out infinite",
    },
    lockIcon: {
        color: "#dc2626",
    },
    errorCodeWrapper: {
        position: "relative",
        display: "inline-block",
        marginBottom: "20px",
    },
    errorCode: {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "80px",
        fontWeight: "700",
        letterSpacing: "-4px",
        lineHeight: 1,
        background: "linear-gradient(135deg, #0f172a 0%, #475569 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "block",
    },
    errorLine: {
        height: "3px",
        background: "linear-gradient(90deg, #ef4444, #f97316)",
        borderRadius: "2px",
        marginTop: "8px",
        transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    title: {
        fontSize: "22px",
        fontWeight: "700",
        color: "#0f172a",
        margin: "0 0 12px 0",
        letterSpacing: "-0.3px",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    subtitle: {
        fontSize: "15px",
        lineHeight: "1.65",
        color: "#64748b",
        margin: "0 0 32px 0",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    actions: {
        display: "flex",
        gap: "12px",
        justifyContent: "center",
        flexWrap: "wrap",
        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
    },
    primaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 24px",
        background: "#0f172a",
        color: "#ffffff",
        border: "none",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer",
        transition: "all 0.25s ease",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    },
    secondaryBtn: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 24px",
        background: "transparent",
        color: "#475569",
        border: "1.5px solid #cbd5e1",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
        fontFamily: "'DM Sans', sans-serif",
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    timer: {
        fontSize: "13px",
        color: "#94a3b8",
        marginTop: "28px",
        transition: "opacity 0.6s ease",
    },
    timerCount: {
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: "500",
        color: "#64748b",
    },
    bottomBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        height: "3px",
        background: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)",
        transition: "width 1.5s cubic-bezier(0.16, 1, 0.3, 1)",
        transitionDelay: "0.3s",
    },
};