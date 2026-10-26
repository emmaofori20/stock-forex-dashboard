import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationService } from './notification.service';
describe('NotificationService', () => {
  let service: NotificationService;
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });
  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });
  it('expires success, info and warning after five seconds but keeps errors persistent', () => {
    service.success('Saved');
    service.info('Information');
    service.warning('Allowance low');
    vi.advanceTimersByTime(4999);
    expect(service.toasts().length).toBe(3);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
    service.error('Network unavailable');
    vi.advanceTimersByTime(60000);
    expect(service.toasts()[0].type).toBe('error');
  });
  it('dismisses manually and suppresses repeated failures, including after dismissal', () => {
    const id = service.error('Network unavailable')!;
    expect(service.error('Network unavailable')).toBe(id);
    expect(service.toasts().length).toBe(1);
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
    expect(service.error('Network unavailable')).toBeNull();
    vi.advanceTimersByTime(30000);
    expect(service.error('Network unavailable')).not.toBeNull();
  });
  it('keeps at most three visible notifications and cleans up evicted timers', () => {
    service.info('One');
    service.info('Two');
    service.info('Three');
    service.error('Four');
    expect(service.toasts().map((item) => item.message)).toEqual(['Two', 'Three', 'Four']);
    vi.advanceTimersByTime(5000);
    expect(service.toasts().map((item) => item.message)).toEqual(['Four']);
  });
  it('pauses dismissal during interaction and resumes with the remaining time', () => {
    const id = service.info('Read at your pace')!;
    vi.advanceTimersByTime(2000);
    service.setPaused(id, true);
    vi.advanceTimersByTime(10000);
    expect(service.toasts().length).toBe(1);
    service.setPaused(id, false);
    vi.advanceTimersByTime(2999);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });
  it('supports longer errors, persistent options and disposes all timers on destroy', () => {
    service.error('Transient server error', { durationMs: 10000 });
    service.warning('Persistent warning', { durationMs: 0 });
    vi.advanceTimersByTime(5000);
    expect(service.toasts().length).toBe(2);
    vi.advanceTimersByTime(5000);
    expect(service.toasts()[0].message).toBe('Persistent warning');
    service.success('Complete');
    service.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
