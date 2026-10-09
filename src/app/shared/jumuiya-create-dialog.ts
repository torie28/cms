import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '../core/http-error';
import { TranslatePipe } from '../core/i18n';
import { Jumuiya, ParishService } from '../core/parish';

/** Adds a jumuiya, with optional members, straight into one kanda. */
@Component({
  selector: 'app-jumuiya-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './jumuiya-create-dialog.html',
})
export class JumuiyaCreateDialog {
  private readonly parish = inject(ParishService);
  private readonly fb = inject(FormBuilder);

  readonly kanda = input.required<{ id: number; name: string }>();
  readonly closed = output<void>();
  readonly done = output<Jumuiya>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    chairperson: ['', Validators.maxLength(255)],
    notes: [''],
    members: this.fb.nonNullable.array([this.memberRow()]),
  });

  protected get members() {
    return this.form.controls.members;
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  protected addMember(): void {
    this.members.push(this.memberRow());
  }

  protected removeMember(index: number): void {
    this.members.removeAt(index);
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
      const raw = this.form.getRawValue();
      const saved = await this.parish.createJumuiya({
        name: raw.name.trim(),
        kanda_id: this.kanda().id,
        chairperson: raw.chairperson.trim(),
        notes: raw.notes.trim(),
        members: raw.members
          .map((member) => ({ name: member.name.trim(), phone: member.phone.trim(), gender: member.gender }))
          .filter((member) => member.name !== ''),
      });
      this.done.emit(saved);
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kuongeza jumuiya hiyo.'));
    } finally {
      this.saving.set(false);
    }
  }

  private memberRow() {
    return this.fb.nonNullable.group({
      name: ['', Validators.maxLength(255)],
      phone: ['', Validators.maxLength(40)],
      gender: [''],
    });
  }
}
