import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styles: [':host{display:block;min-height:100dvh;color:rgb(var(--fg));background:rgb(var(--bg))}.salary-reference-shell{min-height:100dvh}.site-header{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px;padding:0 32px;border-bottom:1px solid rgb(var(--border));background:rgb(var(--panel))}.brand{display:inline-flex;align-items:center;gap:12px;color:inherit;text-decoration:none}.brand__mark{display:grid;width:34px;height:34px;place-items:center;border-radius:8px;background:rgb(var(--primary));color:#102014;font-size:12px;font-weight:900}.brand strong,.brand small{display:block}.brand strong{font-size:14px}.brand small{margin-top:2px;color:rgb(var(--muted));font-size:11px}nav{display:flex;align-items:center;gap:4px}nav a{padding:8px 10px;border-radius:6px;color:rgb(var(--muted));font-size:13px;text-decoration:none}nav a:hover,nav a.is-active{color:rgb(var(--fg));background:rgb(var(--surface))}main{min-height:calc(100dvh - 72px)}@media(max-width:640px){.site-header{align-items:flex-start;flex-direction:column;padding:14px 18px;gap:12px}nav{width:100%;overflow-x:auto}}'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
