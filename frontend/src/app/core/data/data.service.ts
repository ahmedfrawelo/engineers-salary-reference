import { Injectable, signal } from '@angular/core';
import { IR, MIR, Project, QSItem, StoreItem, ir0, mir0, projects0, qs0, store0 } from './models';

@Injectable({ providedIn: 'root' })
export class DataService {
  projects = signal<Project[]>(projects0);
  qs = signal<QSItem[]>(qs0);
  store = signal<StoreItem[]>(store0);
  ir = signal<IR[]>(ir0);
  mir = signal<MIR[]>(mir0);
}
