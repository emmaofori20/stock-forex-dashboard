import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Output() navigate = new EventEmitter<void>();
  readonly links = [
    { path: '/', label: 'Overview', icon: 'overview' },
    { path: '/stocks', label: 'Stocks', icon: 'stocks' },
    { path: '/forex', label: 'Forex', icon: 'forex' },
  ];
}
