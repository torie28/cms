import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-sadaka',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sadaka.html',
})
export class Sadaka {}
