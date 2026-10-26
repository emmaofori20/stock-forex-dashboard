import { Injectable, OnDestroy, signal } from '@angular/core';
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastNotification {
  readonly id: number;
  readonly type: ToastType;
  readonly message: string;
}
export interface NotificationOptions {
  durationMs?: number;
}
interface DismissTimer {
  handle?: ReturnType<typeof setTimeout>;
  remaining: number;
  deadline: number;
}
@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly items = signal<readonly ToastNotification[]>([]);
  readonly toasts = this.items.asReadonly();
  private readonly lastAnnouncement = signal<ToastNotification | null>(null);
  readonly announcement = this.lastAnnouncement.asReadonly();
  private readonly timers = new Map<number, DismissTimer>();
  private readonly recent = new Map<string, number>();
  private nextId = 0;
  success(message: string, options?: NotificationOptions) {
    return this.showToast('success', message, options);
  }
  error(message: string, options?: NotificationOptions) {
    return this.showToast('error', message, options);
  }
  warning(message: string, options?: NotificationOptions) {
    return this.showToast('warning', message, options);
  }
  info(message: string, options?: NotificationOptions) {
    return this.showToast('info', message, options);
  }
  dismiss(id: number): void {
    this.clearDismissTimer(id);
    this.items.update((items) => items.filter((item) => item.id !== id));
    if (this.lastAnnouncement()?.id === id) this.lastAnnouncement.set(null);
  }
  setPaused(id: number, paused: boolean): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    if (paused && timer.handle !== undefined) {
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining = Math.max(0, timer.deadline - Date.now());
    } else if (!paused && timer.handle === undefined) this.scheduleDismissal(id, timer);
  }
  ngOnDestroy(): void {
    for (const id of this.timers.keys()) this.clearDismissTimer(id);
    this.recent.clear();
  }
  private showToast(
    type: ToastType,
    message: string,
    options: NotificationOptions = {},
  ): number | null {
    message = message.trim();
    if (!message) return null;
    const key = type + ':' + message,
      now = Date.now();
    for (const [entry, until] of this.recent) if (until <= now) this.recent.delete(entry);
    const existing = this.items().find((item) => item.type === type && item.message === message);
    if (existing) return existing.id;
    // Suppress repeated failed requests briefly even after manual dismissal/eviction.
    if ((this.recent.get(key) ?? 0) > now) return null;
    this.recent.set(key, now + 30000);
    if (this.items().length === 3) this.dismiss(this.items()[0].id);
    const toast: ToastNotification = { id: ++this.nextId, type, message };
    this.items.update((items) => [...items, toast]);
    this.lastAnnouncement.set(toast);
    const duration = options.durationMs ?? (type === 'error' ? 0 : 5000);
    if (Number.isFinite(duration) && duration > 0) {
      const timer = { remaining: duration, deadline: 0 };
      this.timers.set(toast.id, timer);
      this.scheduleDismissal(toast.id, timer);
    }
    return toast.id;
  }
  private scheduleDismissal(id: number, timer: DismissTimer): void {
    timer.deadline = Date.now() + timer.remaining;
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }
  private clearDismissTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}
