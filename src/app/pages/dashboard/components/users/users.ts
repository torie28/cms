import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../../../core/i18n';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './users.html',
})
export class Users {
  protected readonly tabs = [
    { label: 'Watumiaji', path: '/users', exact: true },
    { label: 'Nyadhifa', path: '/users/roles', exact: false },
  ];
}
