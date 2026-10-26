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
  isSidebarCollapsed = false;
  isMobileSidebarOpen = false;
  private previousFocus: HTMLElement | null = null;
  @ViewChild('content') content?: ElementRef<HTMLElement>;
  @ViewChild('drawer') drawer?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') set closeButton(button: ElementRef<HTMLButtonElement> | undefined) {
    button?.nativeElement.focus();
  }
  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }
  toggleMobileSidebar(): void {
    if (this.isMobileSidebarOpen) {
      this.closeMobileSidebar();
      return;
    }
    this.previousFocus = document.activeElement as HTMLElement;
    this.isMobileSidebarOpen = true;
  }
  @HostListener('document:keydown.escape') closeMobileSidebar() {
    if (this.isMobileSidebarOpen) {
      this.isMobileSidebarOpen = false;
      this.content?.nativeElement.removeAttribute('inert');
      this.previousFocus?.focus();
    }
  }
  @HostListener('window:resize') onResize() {
    if (window.innerWidth >= 1024) this.closeMobileSidebar();
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
