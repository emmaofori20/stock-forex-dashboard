import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { NotificationService } from '../../../core/services/notification.service';
describe('ToastContainerComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToastContainerComponent] });
  });
  afterEach(() => {
    TestBed.inject(NotificationService).ngOnDestroy();
    vi.useRealTimers();
  });
  it('renders correct live regions and working manual dismissal', () => {
    const view = TestBed.createComponent(ToastContainerComponent);
    view.detectChanges();
    const service = TestBed.inject(NotificationService);
    service.error('The network is unavailable');
    view.detectChanges();
    const element = view.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-live="assertive"]')?.textContent).toContain('network');
    expect(element.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('');
    expect(element.querySelector('app-icon path')?.getAttribute('d')).toBeTruthy();
    element.querySelector<HTMLButtonElement>('button')!.click();
    view.detectChanges();
    expect(element.querySelectorAll('app-toast').length).toBe(0);
    service.info('Daily history loaded');
    view.detectChanges();
    expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Daily history loaded',
    );
  });
  it('keeps a toast visible while hovered or keyboard-focused, then resumes dismissal', () => {
    const view = TestBed.createComponent(ToastContainerComponent);
    const service = TestBed.inject(NotificationService);
    service.warning('Read this warning');
    view.detectChanges();
    const article = (view.nativeElement as HTMLElement).querySelector('article')!;
    article.dispatchEvent(new Event('mouseenter'));
    article.dispatchEvent(new FocusEvent('focusin'));
    article.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(10000);
    expect(service.toasts().length).toBe(1);
    article.dispatchEvent(new FocusEvent('focusout', { relatedTarget: document.body }));
    vi.advanceTimersByTime(5000);
    expect(service.toasts().length).toBe(0);
  });
});
