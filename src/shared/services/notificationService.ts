/**
 * Notification service
 * Lightweight notification helper types
 * Framework-safe, no global mounting yet
 */

/**
 * Notification types
 */
export type NotificationType = "success" | "error" | "info" | "warning";

/**
 * Notification message interface
 */
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  timestamp: number;
}

/**
 * Create a notification message
 */
export function createNotification(
  message: string,
  type: NotificationType = "info",
  duration: number = 4000
): NotificationMessage {
  return {
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    message,
    duration,
    timestamp: Date.now(),
  };
}

/**
 * Create success notification
 */
export function createSuccessNotification(message: string, duration: number = 4000): NotificationMessage {
  return createNotification(message, "success", duration);
}

/**
 * Create error notification
 */
export function createErrorNotification(message: string, duration: number = 6000): NotificationMessage {
  return createNotification(message, "error", duration);
}

/**
 * Create warning notification
 */
export function createWarningNotification(message: string, duration: number = 5000): NotificationMessage {
  return createNotification(message, "warning", duration);
}

/**
 * Create info notification
 */
export function createInfoNotification(message: string, duration: number = 4000): NotificationMessage {
  return createNotification(message, "info", duration);
}

/**
 * Notification queue for future use
 * This can be used with a global provider in later phases
 */
class NotificationQueue {
  private queue: NotificationMessage[] = [];
  private listeners: Set<(notification: NotificationMessage) => void> = new Set();

  add(notification: NotificationMessage): void {
    this.queue.push(notification);
    this.notifyListeners(notification);
  }

  remove(id: string): void {
    this.queue = this.queue.filter((n) => n.id !== id);
  }

  clear(): void {
    this.queue = [];
  }

  getAll(): NotificationMessage[] {
    return [...this.queue];
  }

  subscribe(listener: (notification: NotificationMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(notification: NotificationMessage): void {
    this.listeners.forEach((listener) => listener(notification));
  }
}

// Singleton instance for future use
export const notificationQueue = new NotificationQueue();
