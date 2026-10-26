import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ToastNotification, ToastType } from '../../../core/services/notification.service';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  @Input({ required: true }) toast!: ToastNotification;
  @Output() dismissed = new EventEmitter<void>();
  @Output() pausedChange = new EventEmitter<boolean>();
  private hovered = false;
  private focused = false;
  readonly styles: Record<
    ToastType,
    { title: string; icon: string; tone: string; border: string }
  > = {
    success: {
      title: 'Success',
      icon: 'check-circle',
      tone: 'bg-success/10 text-success',
      border: 'border-success/25',
    },
    error: {
      title: 'Error',
      icon: 'error-circle',
      tone: 'bg-danger/10 text-danger',
      border: 'border-danger/25',
    },
    warning: {
      title: 'Warning',
      icon: 'warning',
      tone: 'bg-warning/10 text-warning',
      border: 'border-warning/30',
    },
    info: {
      title: 'Information',
      icon: 'info',
      tone: 'bg-primary-light text-primary',
      border: 'border-primary/25',
    },
  };
  get appearance() {
    return this.styles[this.toast.type];
  }
  setHovered(value: boolean): void {
    this.hovered = value;
    this.pausedChange.emit(this.hovered || this.focused);
  }
  setFocused(value: boolean): void {
    this.focused = value;
    this.pausedChange.emit(this.hovered || this.focused);
  }
  onFocusOut(event: FocusEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
      this.setFocused(false);
  }
}
