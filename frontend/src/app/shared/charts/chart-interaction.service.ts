import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ChartDatum } from './chart-types';

export type ChartInteraction = {
  source: string;
  datum: ChartDatum;
};

@Injectable({ providedIn: 'root' })
export class ChartInteractionService {
  private readonly interaction$ = new Subject<ChartInteraction>();

  readonly selections$ = this.interaction$.asObservable();

  emit(source: string, datum: ChartDatum): void {
    this.interaction$.next({ source, datum });
  }
}
