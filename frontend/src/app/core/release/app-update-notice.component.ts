import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReleaseUpdateService } from './release-update.service';

@Component({
  selector: 'app-update-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updates.state() !== 'idle') {
      <div class="release-update-overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
        <div class="release-update-card">
          <div class="release-update-spinner" aria-hidden="true"></div>
          <h2>{{ updates.state() === 'updating' ? 'الموقع قيد التحديث حالياً' : 'تم تحديث الموقع بنجاح' }}</h2>
          <p>{{ updates.state() === 'updating' ? 'يرجى الانتظار لحظات…' : 'سيتم إعادة تحميل الصفحة الآن.' }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .release-update-overlay { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; background: rgba(8, 9, 11, .86); backdrop-filter: blur(8px); }
    .release-update-card { width: min(420px, calc(100vw - 40px)); padding: 32px 28px; border: 1px solid rgba(157, 226, 35, .3); border-radius: 18px; background: #17191b; color: #f4f7ef; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.5); }
    .release-update-card h2 { margin: 18px 0 8px; font-size: 20px; }
    .release-update-card p { margin: 0; color: #aeb5ab; }
    .release-update-spinner { width: 34px; height: 34px; margin: auto; border: 3px solid #3c4937; border-top-color: #9de223; border-radius: 50%; animation: release-spin .8s linear infinite; }
    @keyframes release-spin { to { transform: rotate(360deg); } }
  `]
})
export class AppUpdateNoticeComponent {
  readonly updates = inject(ReleaseUpdateService);
}
