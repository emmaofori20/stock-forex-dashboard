import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="h-full w-full"
  >
    <path [attr.d]="paths[name] || paths['chart']" />
  </svg>`,
  styles: [':host {display:inline-block;width:1.25rem;height:1.25rem;flex-shrink:0}'],
})
export class IconComponent {
  @Input() name = 'chart';
  readonly paths: Record<string, string> = {
    'check-circle': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M7 12l3 3 7-7',
    'error-circle': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M8 8l8 8 M8 16l8-8',
    warning: 'M12 3L2 21h20L12 3z M12 9v5 M12 17h.01',
    overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    'trend-up': 'M3 17l6-6 4 3 8-10 M15 4h6v6',
    'trend-down': 'M3 7l6 6 4-3 8 10 M15 20h6v-6',
    stocks: 'M3 17l6-6 4 3 8-10 M15 4h6v6',
    forex: 'M4 7h16l-4-4 M20 17H4l4 4',
    chart: 'M4 4v16h17 M8 15v-4 M13 15V7 M18 15v-6',
    arrow: 'M5 12h14 M14 7l5 5-5 5',
    'panel-left-close': 'M3 3h18v18H3z M9 3v18 M16 8l-4 4 4 4',
    'panel-left-open': 'M3 3h18v18H3z M9 3v18 M13 8l4 4-4 4',
    menu: 'M4 6h16 M4 12h16 M4 18h16',
    close: 'M6 6l12 12 M6 18L18 6',
    info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
    table: 'M3 5h18v14H3z M3 10h18 M9 10v9 M15 10v9',
  };
}
