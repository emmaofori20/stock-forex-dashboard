import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout.component';

describe('Dashboard sidebar navigation', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [DashboardLayoutComponent],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'stocks', children: [] },
          { path: 'forex', children: [] },
        ]),
      ],
    }),
  );
  function render() {
    const view = TestBed.createComponent(DashboardLayoutComponent);
    view.detectChanges();
    const element = view.nativeElement as HTMLElement;
    const button = (name: string) =>
      element.querySelector<HTMLButtonElement>('button[aria-label="' + name + '"]')!;
    return { view, element, button };
  }
  it('collapses to an icon rail, expands content, and restores labels', () => {
    const { view, element, button } = render();
    const sidebar = element.querySelector('#desktop-navigation')!;
    const content = element.querySelector('app-navbar')!.parentElement!;
    expect(sidebar.classList.contains('w-64')).toBe(true);
    expect(content.classList.contains('lg:ml-64')).toBe(true);
    button('Collapse sidebar').click();
    view.detectChanges();
    expect(sidebar.classList.contains('w-20')).toBe(true);
    expect(content.classList.contains('lg:ml-20')).toBe(true);
    expect(sidebar.textContent).not.toContain('Workspace');
    expect(sidebar.querySelector('a[aria-label="Stocks"]')?.getAttribute('title')).toBe('Stocks');
    expect(sidebar.querySelector('a[aria-label="Stocks"]')?.textContent?.trim()).toBe('');
    expect(button('Expand sidebar').getAttribute('aria-expanded')).toBe('false');
    expect(sidebar.classList.contains('duration-200')).toBe(true);
    expect(sidebar.classList.contains('motion-reduce:transition-none')).toBe(true);
    button('Expand sidebar').click();
    view.detectChanges();
    expect(content.classList.contains('lg:ml-64')).toBe(true);
    expect(sidebar.textContent).toContain('MarketDash');
    expect(sidebar.textContent).toContain('Stocks');
  });
  it('keeps active route highlighting and accessible names when collapsed', async () => {
    const { view, element, button } = render();
    button('Collapse sidebar').click();
    view.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/stocks');
    view.detectChanges();
    const link = element.querySelector('#desktop-navigation a[aria-label="Stocks"]')!;
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.classList.contains('nav-active')).toBe(true);
  });
  it('opens an expanded mobile drawer independently, traps focus, and restores focus on Escape', () => {
    const { view, element, button } = render();
    button('Collapse sidebar').click();
    view.detectChanges();
    const opener = button('Open navigation');
    opener.focus();
    opener.click();
    view.detectChanges();
    const drawer = element.querySelector<HTMLElement>('#mobile-navigation')!;
    expect(opener.getAttribute('aria-expanded')).toBe('true');
    expect(opener.getAttribute('aria-controls')).toBe(drawer.id);
    expect(drawer.textContent).toContain('Stocks');
    expect(document.activeElement).toBe(button('Close navigation'));
    const links = drawer.querySelectorAll<HTMLAnchorElement>('a');
    links[links.length - 1].focus();
    drawer.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(button('Close navigation'));
    button('Close navigation').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(links[links.length - 1]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    view.detectChanges();
    expect(element.querySelector('#mobile-navigation')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(view.componentInstance.isSidebarCollapsed).toBe(true);
    expect(opener.getAttribute('aria-expanded')).toBe('false');
  });
  it('closes on backdrop, close button, and route selection', async () => {
    const { view, element, button } = render();
    for (const action of ['backdrop', 'close', 'link']) {
      button('Open navigation').click();
      view.detectChanges();
      if (action === 'backdrop') button('Close navigation backdrop').click();
      else if (action === 'close') button('Close navigation').click();
      else
        element
          .querySelector<HTMLAnchorElement>('#mobile-navigation a[aria-label="Forex"]')!
          .click();
      view.detectChanges();
      await view.whenStable();
      expect(element.querySelector('#mobile-navigation')).toBeNull();
    }
    expect(TestBed.inject(Router).url).toBe('/forex');
  });
});
