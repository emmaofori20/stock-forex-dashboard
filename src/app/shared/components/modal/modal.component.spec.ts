import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ModalComponent } from './modal.component';
@Component({
  standalone: true,
  imports: [ModalComponent],
  template: `<button id="opener" (click)="open = true">Investigate error</button
    ><app-modal
      [open]="open"
      title="Error details"
      message="Daily history is unavailable. Retry or close."
      primaryLabel="Retry"
      secondaryLabel="Close"
      [closeOnBackdrop]="backdrop"
      (primaryAction)="retried = true"
      (secondaryAction)="secondary = true"
      (closed)="open = false"
    />`,
})
class Host {
  open = false;
  backdrop = true;
  retried = false;
  secondary = false;
}
describe('ModalComponent keyboard and actions', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));
  function setup() {
    const view = TestBed.createComponent(Host);
    view.detectChanges();
    const element = view.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog')!;
    // jsdom does not implement native top-layer focus/inert behavior. Mock only
    // showModal/close; browser checks cover the actual native dialog separately.
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    const opener = element.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    opener.click();
    view.detectChanges();
    return { view, element, dialog, opener };
  }
  it('labels the dialog, focuses Close and traps Tab in both directions', () => {
    const { dialog } = setup();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    const buttons = dialog.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[1]);
    buttons[0].focus();
    buttons[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(buttons[2]);
    buttons[2].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(buttons[0]);
  });
  it('Escape closes, restores focus and restores body scrolling', () => {
    const before = document.body.style.overflow;
    const { view, dialog, opener } = setup();
    expect(document.body.style.overflow).toBe('hidden');
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    view.detectChanges();
    expect(view.componentInstance.open).toBe(false);
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe(before);
  });
  it('emits a primary action only when requested and closes afterward', () => {
    const { view, dialog } = setup();
    expect(view.componentInstance.retried).toBe(false);
    dialog.querySelectorAll<HTMLButtonElement>('button')[2].click();
    view.detectChanges();
    expect(view.componentInstance.retried).toBe(true);
    expect(dialog.open).toBe(false);
  });
  it('supports secondary and close buttons without triggering Retry', () => {
    const { view, dialog } = setup();
    dialog.querySelectorAll<HTMLButtonElement>('button')[1].click();
    view.detectChanges();
    expect(view.componentInstance.secondary).toBe(true);
    expect(view.componentInstance.retried).toBe(false);
    view.componentInstance.open = true;
    view.detectChanges();
    dialog.querySelector<HTMLButtonElement>('button')!.click();
    view.detectChanges();
    expect(dialog.open).toBe(false);
    expect(view.componentInstance.retried).toBe(false);
  });
  it('dismisses only actual backdrop clicks when enabled and cleans up on destroy', () => {
    const { view, dialog } = setup();
    dialog.querySelector('p')!.click();
    expect(dialog.open).toBe(true);
    view.componentInstance.backdrop = false;
    view.detectChanges();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    expect(dialog.open).toBe(true);
    view.componentInstance.backdrop = true;
    view.detectChanges();
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 100, clientY: 100, bubbles: true }));
    view.detectChanges();
    expect(dialog.open).toBe(false);
    view.componentInstance.open = true;
    view.detectChanges();
    view.destroy();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
