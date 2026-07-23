import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthScreenComponent } from './auth-screen/auth-screen.component';

@Component({
  selector: 'feature-auth-login-page',
  standalone: true,
  imports: [AuthScreenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<feature-auth-screen />'
})
export class LoginFeaturePageComponent {}
