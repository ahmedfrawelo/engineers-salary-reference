import { Directive, HostListener, Input } from '@angular/core';
import { ChartDatum } from './chart-types';
import { ChartInteractionService } from './chart-interaction.service';

@Directive({
  selector: '[engineers-salary-referenceChartInteraction]',
  standalone: true
})
export class EngineersSalaryChartInteractionDirective {
  @Input('engineers-salary-referenceChartInteraction') source = 'chart';

  constructor(private interaction: ChartInteractionService) {}

  @HostListener('itemClick', ['$event'])
  onItemClick(datum: ChartDatum): void {
    if (!datum) return;
    this.interaction.emit(this.source || 'chart', datum);
  }
}
