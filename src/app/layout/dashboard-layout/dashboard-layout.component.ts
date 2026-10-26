import { ToastContainerComponent } from '../../shared/components/toast-container/toast-container.component';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    NavbarComponent,
    IconComponent,
    ToastContainerComponent,
  ],
  templateUrl: './dashboard-layout.component.html',
})
export class DashboardLayoutComponent {
  mobileOpen = false;
  private previousFocus: HTMLElement | null = null;
  @ViewChild('drawer') drawer?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') set closeButton(button: ElementRef<HTMLButtonElement> | undefined) {
    button?.nativeElement.focus();
  }
  openMenu() {
    this.previousFocus = document.activeElement as HTMLElement;
    this.mobileOpen = true;
  }
  @HostListener('document:keydown.escape') closeMenu() {
    if (this.mobileOpen) {
      this.mobileOpen = false;
      this.previousFocus?.focus();
    }
  }
  @HostListener('window:resize') onResize() {
    if (window.innerWidth >= 1024) this.closeMenu();
  }
  trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = this.drawer?.nativeElement.querySelectorAll<HTMLElement>('a,button');
    if (!items?.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
