import { TestBed } from '@angular/core/testing';
import { notifyMarketFailure } from './market-notifications';
import { NotificationService } from '../../core/services/notification.service';
describe('Page-level market notifications', () => {
  it('ignores successful, loading and empty data states', () => {
    const notifications = TestBed.inject(NotificationService);
    for (const status of ['loading', 'success', 'empty'] as const)
      notifyMarketFailure(notifications, { status });
    expect(notifications.toasts().length).toBe(0);
  });
  it('deduplicates concurrent rate failures and distinguishes network/unavailable errors', () => {
    const notifications = TestBed.inject(NotificationService);
    for (let i = 0; i < 3; i++)
      notifyMarketFailure(notifications, {
        status: 'error',
        errorKind: 'rate-limit',
        message: 'Allowance reached',
      });
    expect(notifications.toasts().map((toast) => toast.type)).toEqual(['warning']);
    notifyMarketFailure(notifications, {
      status: 'error',
      errorKind: 'network',
      message: 'Connection unavailable',
    });
    notifyMarketFailure(notifications, {
      status: 'error',
      errorKind: 'unavailable',
      message: 'Provider unavailable',
    });
    expect(notifications.toasts().map((toast) => toast.type)).toEqual([
      'warning',
      'error',
      'error',
    ]);
  });
});
