import { Component } from '@angular/core';
import { Overview } from './components/overview/overview';

@Component({
  selector: 'app-dashboard',
  imports: [Overview],
  templateUrl: './dashboard.html',
})
export class Dashboard {}
