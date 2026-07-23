import { Directive, Input } from '@angular/core';
import type { UserAccessControlComponentDrawer } from '../user-access-control.component.drawer';

/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

@Directive({
  standalone: false
})
export abstract class UserAccessControlHostedSectionBase {
  @Input({ required: true })
  host!: UserAccessControlComponentDrawer;

  constructor() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const host = Reflect.get(target, 'host', receiver) as
          | UserAccessControlComponentDrawer
          | undefined;
        const value = host?.[prop as keyof UserAccessControlComponentDrawer];
        return typeof value === 'function' ? value.bind(host) : value;
      },
      set(target, prop, value, receiver) {
        if (prop === 'host' || prop in target) {
          return Reflect.set(target, prop, value, receiver);
        }
        const host = Reflect.get(target, 'host', receiver) as
          | UserAccessControlComponentDrawer
          | undefined;
        if (host && prop in host) {
          (host as unknown as Record<PropertyKey, unknown>)[prop] = value;
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
      }
    });
  }
}

// Angular templates type-check against the hosted-section component instance,
// while runtime access is forwarded to the parent drawer through a Proxy.
// This merged surface keeps the drawer contract visible to the template
// checker without re-declaring the full API in every hosted child component.
export interface UserAccessControlHostedSectionBase extends UserAccessControlComponentDrawer {
  readonly __hostProxyBrand__?: never;
}
