import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

@Injectable()
export class SidebarRouteReuseStrategy implements RouteReuseStrategy {
  private readonly storedRoutes = new Map<string, DetachedRouteHandle>();

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.isReusable(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!handle || !this.isReusable(route)) {
      return;
    }
    this.storedRoutes.set(this.buildRouteKey(route), handle);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    return this.isReusable(route) && this.storedRoutes.has(this.buildRouteKey(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!this.isReusable(route)) {
      return null;
    }
    return this.storedRoutes.get(this.buildRouteKey(route)) ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private isReusable(route: ActivatedRouteSnapshot): boolean {
    return route.data?.['reuse'] === true && !!route.routeConfig?.path;
  }

  private buildRouteKey(route: ActivatedRouteSnapshot): string {
    return route.pathFromRoot
      .map(snapshot => snapshot.routeConfig?.path ?? '')
      .filter(Boolean)
      .join('/');
  }
}
