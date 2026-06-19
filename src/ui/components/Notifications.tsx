import React, { useState, useEffect } from "react";
import type { Patient } from "../types";

export interface Notification {
  id: string;
  type: "follow-up" | "insurance" | "alert" | "info";
  title: string;
  message: string;
  patientId?: string;
  patientName?: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationsProps {
  patients: Patient[];
}

export function Notifications({ patients }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    generateNotifications();
  }, [patients]);

  function generateNotifications() {
    const now = new Date();
    const newNotifications: Notification[] = [];

    // Follow-up overdue notifications
    patients.forEach(p => {
      if (p.followUpDate && new Date(p.followUpDate) < now) {
        newNotifications.push({
          id: `followup-${p.id}`,
          type: "follow-up",
          title: "Follow-up Overdue",
          message: `${p.name} has an overdue follow-up since ${new Date(p.followUpDate).toLocaleDateString()}`,
          patientId: p.id,
          patientName: p.name,
          timestamp: new Date(p.followUpDate),
          read: false,
        });
      }

      // Insurance expiring notifications
      if (p.insuranceStatus === "Expiring" && p.insuranceExpiry) {
        const expiryDate = new Date(p.insuranceExpiry);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry <= 30) {
          newNotifications.push({
            id: `insurance-${p.id}`,
            type: "insurance",
            title: `Insurance Expiring in ${daysUntilExpiry} Days`,
            message: `${p.name}'s insurance with ${p.insurer} expires on ${expiryDate.toLocaleDateString()}`,
            patientId: p.id,
            patientName: p.name,
            timestamp: expiryDate,
            read: false,
          });
        }
      }

      // Insurance expired notifications
      if (p.insuranceStatus === "Expired" && p.insuranceExpiry) {
        newNotifications.push({
          id: `insurance-expired-${p.id}`,
          type: "insurance",
          title: "Insurance Expired",
          message: `${p.name}'s insurance with ${p.insurer} expired on ${new Date(p.insuranceExpiry).toLocaleDateString()}`,
          patientId: p.id,
          patientName: p.name,
          timestamp: new Date(p.insuranceExpiry),
          read: false,
        });
      }

      // Critical alerts
      if (p.alerts && p.alerts.some(a => ["Allergy", "Heart Condition", "High Risk"].includes(a))) {
        newNotifications.push({
          id: `alert-${p.id}`,
          type: "alert",
          title: "Critical Medical Alert",
          message: `${p.name} has critical medical alerts: ${p.alerts.filter(a => ["Allergy", "Heart Condition", "High Risk"].includes(a)).join(", ")}`,
          patientId: p.id,
          patientName: p.name,
          timestamp: new Date(p.lastVisit || p.createdAt || now),
          read: false,
        });
      }
    });

    // Sort by timestamp (most recent first) and limit to 20
    newNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setNotifications(newNotifications.slice(0, 20));
    setUnreadCount(newNotifications.filter(n => !n.read).length);
  }

  function markAsRead(id: string) {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  function dismissNotification(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (notifications.find(n => n.id === id)?.read === false) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "follow-up": return "ti-clock-exclamation";
      case "insurance": return "ti-shield-exclamation";
      case "alert": return "ti-alert-triangle";
      case "info": return "ti-info-circle";
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "follow-up": return "var(--amber)";
      case "insurance": return "var(--blue)";
      case "alert": return "var(--red)";
      case "info": return "var(--green)";
    }
  };

  const getNotificationBg = (type: Notification["type"]) => {
    switch (type) {
      case "follow-up": return "var(--amber-bg)";
      case "insurance": return "var(--blue-bg)";
      case "alert": return "var(--red-bg)";
      case "info": return "var(--green-bg)";
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn-icon"
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: "relative" }}
      >
        <i className="ti ti-bell" style={{ fontSize: 18 }} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: -4,
            right: -4,
            background: "var(--red)",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 8,
          width: 380,
          maxHeight: 500,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 1000,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface2)",
          }}>
            <span style={{ fontSize: "var(--font-sm)", fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "var(--font-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--muted)",
              }}>
                <i className="ti ti-bell-off" style={{ fontSize: 32, marginBottom: 8 }} />
                <div style={{ fontSize: "var(--font-sm)" }}>No notifications</div>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: notification.read ? "transparent" : "var(--accent-soft)",
                    cursor: "pointer",
                  }}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: getNotificationBg(notification.type),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <i className={`ti ${getNotificationIcon(notification.type)}`} style={{ fontSize: 16, color: getNotificationColor(notification.type) }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--font-sm)", fontWeight: 600, marginBottom: 2 }}>
                        {notification.title}
                      </div>
                      <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)", marginBottom: 4 }}>
                        {notification.message}
                      </div>
                      <div style={{ fontSize: "var(--font-2xs)", color: "var(--muted)" }}>
                        {notification.timestamp.toLocaleDateString()} · {notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notification.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                        padding: 4,
                        opacity: 0.5,
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = "0.5"}
                    >
                      <i className="ti ti-x" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface2)",
            }}>
              <button
                onClick={() => {
                  markAllAsRead();
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "8px",
                  fontSize: "var(--font-sm)",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
