import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './settings.html',
})
export class Settings {}
