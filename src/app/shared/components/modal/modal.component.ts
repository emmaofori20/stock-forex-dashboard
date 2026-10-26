import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './modal.component.html',
  styles: [
    'dialog::backdrop { background: color-mix(in srgb, var(--color-heading) 50%, transparent); }',
  ],
})
export class ModalComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static nextId = 0;
  readonly dialogId = `market-dialog-${++ModalComponent.nextId}`;
  @Input() open = false;
  @Input() title = 'Details';
  @Input() message = '';
  @Input() primaryLabel = 'Retry';
  @Input() secondaryLabel = 'Close';
  @Input() closeOnBackdrop = true;
  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('secondary', { static: true }) private secondary!: ElementRef<HTMLButtonElement>;
  private ready = false;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private active = false;
  ngAfterViewInit(): void {
    this.ready = true;
    this.sync();
  }
  ngOnChanges(): void {
    if (this.ready) this.sync();
  }
  ngOnDestroy(): void {
    this.hide();
  }
  dismiss(): void {
    this.hide();
    this.closed.emit();
  }
  onPrimary(): void {
    this.primaryAction.emit();
    this.dismiss();
  }
  onSecondary(): void {
    this.secondaryAction.emit();
    this.dismiss();
  }
  onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss();
  }
  onBackdrop(event: MouseEvent): void {
    if (!this.closeOnBackdrop || event.target !== this.dialog.nativeElement) return;
    const rect = this.dialog.nativeElement.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.dismiss();
  }
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.dismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons =
      this.dialog.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  private sync(): void {
    if (!this.open) {
      this.hide();
      return;
    }
    if (this.active) return;
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.dialog.nativeElement.showModal();
    this.active = true;
    this.secondary.nativeElement.focus();
  }
  private hide(): void {
    if (!this.active) return;
    this.dialog.nativeElement.close();
    this.active = false;
    document.body.style.overflow = this.previousOverflow;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    else document.querySelector<HTMLElement>('main')?.focus();
  }
}
