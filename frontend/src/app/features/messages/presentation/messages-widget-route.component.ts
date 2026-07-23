import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'feature-messages-widget-route',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``
})
export class MessagesWidgetRouteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const conversationId = this.route.snapshot.queryParamMap.get('conversationId');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('engineers-salary-reference:messages-open', {
          detail: { conversationId }
        })
      );
    }
    void this.router.navigateByUrl('/dashboard', { replaceUrl: true });
  }
}
