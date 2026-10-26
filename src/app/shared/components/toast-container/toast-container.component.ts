import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastComponent } from '../toast/toast.component';
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [ToastComponent],
  templateUrl: './toast-container.component.html',
})
export class ToastContainerComponent {
  readonly notifications = inject(NotificationService);
}
