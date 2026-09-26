import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../../../../core/http-error';
import { Kanda, ParishService } from '../../../../core/parish';

@Component({
  selector: 'app-kanda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './kanda.html',
})
export class KandaPage {
  private readonly parish = inject(ParishService);

  protected readonly kandas = signal<Kanda[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly skeletonCards = [1, 2, 3];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    leader: [''],
    notes: [''],
  });

  constructor() {
    afterNextRender(() => {
      void this.refresh();
    });
  }

  protected openForm(): void {
    this.form.reset({ name: '', leader: '', notes: '' });
    this.error.set(null);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      this.kandas.set(await this.parish.listKandas());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia kanda.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const created = await this.parish.createKanda(this.form.getRawValue());
      this.kandas.update((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.closeForm();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuongeza kanda hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }
}
