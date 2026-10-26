import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private router = inject(Router);
  @Output() toggle = new EventEmitter<void>();
  @Input() mobileOpen = false;
  readonly pageTitle = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        return (route.data['title'] as string) || 'Overview';
      }),
    ),
    { initialValue: 'Overview' },
  );
}
