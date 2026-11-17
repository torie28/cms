import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../../../core/confirm';
import { httpErrorMessage } from '../../../../core/http-error';
import { currentLang, translate, TranslatePipe } from '../../../../core/i18n';
import {
  DirectoryPerson,
  Jumuiya,
  JumuiyaMember,
  Kanda,
  ParishService,
  Role,
  ROLE_OPTIONS,
} from '../../../../core/parish';
import { fuzzyScore } from '../../../../shared/fuzzy';

/** Phone country codes offered in the picker; Tanzania is the default. */
const DIAL_CODES = ['+255', '+254', '+256', '+257', '+250', '+260', '+265', '+1', '+44', '+971', '+91'];

interface Draft {
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  zone_role: Role | '';
  community_role: Role | '';
  dial: string;
  phone: string;
}

type Suggestion =
  | { kind: 'zone'; id: number; label: string; sub: string; score: number }
  | { kind: 'community'; id: number; zoneId: number; label: string; sub: string; score: number }
  | { kind: 'person'; id: number; zoneId: number; communityId: number; label: string; sub: string; score: number };

@Component({
  selector: 'app-zones-communities',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgClass, NgTemplateOutlet],
  templateUrl: './zones-communities.html',
})
export class ZonesCommunitiesPage {
  private readonly parish = inject(ParishService);
  private readonly confirm = inject(ConfirmService);

  protected readonly loading = signal(true);
  protected readonly zones = signal<Kanda[]>([]);
  protected readonly communities = signal<Jumuiya[]>([]);
  protected readonly people = signal<DirectoryPerson[]>([]);

  protected readonly selectedZoneId = signal<number | null>(null);
  protected readonly selectedCommunityId = signal<number | null>(null);
  protected readonly search = signal('');
  protected readonly highlightedId = signal<number | null>(null);
  protected readonly notice = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  protected readonly saving = signal(false);

  // Dropdown + inline-add state.
  protected readonly zoneMenuOpen = signal(false);
  protected readonly communityMenuOpen = signal(false);
  protected readonly addingZone = signal(false);
  protected readonly addingCommunity = signal(false);
  protected readonly newName = signal('');

  // Inline people entry.
  protected readonly adding = signal(false);
  protected readonly draft = signal<Draft>(this.emptyDraft());
  protected readonly editingId = signal<number | null>(null);

  protected readonly dialCodes = DIAL_CODES;

  protected readonly roleChoices = computed(() => {
    const en = currentLang() === 'en';
    return [
      { value: '' as Role | '', label: 'Ordinary' },
      ...ROLE_OPTIONS.map((option) => ({ value: option.value as Role | '', label: en ? option.en : option.sw })),
    ];
  });

  protected readonly sortedZones = computed(() =>
    [...this.zones()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly zoneCommunities = computed(() => {
    const zoneId = this.selectedZoneId();
    return this.communities()
      .filter((community) => community.kanda_id === zoneId)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly selectedZone = computed(
    () => this.zones().find((zone) => zone.id === this.selectedZoneId()) ?? null,
  );

  protected readonly selectedCommunity = computed(
    () => this.communities().find((community) => community.id === this.selectedCommunityId()) ?? null,
  );

  protected readonly communityPeople = computed(() => {
    const communityId = this.selectedCommunityId();
    if (communityId === null) return [];
    return this.people()
      .filter((person) => person.jumuiya_id === communityId)
      .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '') || a.first_name.localeCompare(b.first_name));
  });

  /** Headline numbers for the picked zone, and the picked community when there is one. */
  protected readonly zoneStats = computed(() => {
    const zone = this.selectedZone();
    if (!zone) return null;
    const inZone = this.people().filter((person) => person.jumuiya.kanda_id === zone.id);
    const communities = this.zoneCommunities();
    return {
      communities: communities.length,
      people: inZone.length,
      male: inZone.filter((person) => person.gender === 'male').length,
      female: inZone.filter((person) => person.gender === 'female').length,
      leaders: this.leadersOf(inZone, 'zone_role'),
    };
  });

  protected readonly communityStats = computed(() => {
    const community = this.selectedCommunity();
    if (!community) return null;
    const people = this.communityPeople();
    return {
      people: people.length,
      male: people.filter((person) => person.gender === 'male').length,
      female: people.filter((person) => person.gender === 'female').length,
      leaders: this.leadersOf(people, 'community_role'),
    };
  });

  /** Top suggestions across zones, communities and people — tight, so it never floods. */
  protected readonly suggestions = computed<Suggestion[]>(() => {
    const query = this.search().trim();
    if (query.length < 2) return [];

    const results: Suggestion[] = [];

    for (const zone of this.zones()) {
      const score = fuzzyScore(query, zone.name);
      if (score > 0) results.push({ kind: 'zone', id: zone.id, label: zone.name, sub: translate('Kanda'), score });
    }

    for (const community of this.communities()) {
      const score = fuzzyScore(query, community.name);
      if (score > 0) {
        results.push({
          kind: 'community',
          id: community.id,
          zoneId: community.kanda_id,
          label: community.name,
          sub: community.kanda?.name ?? translate('Jumuiya'),
          score,
        });
      }
    }

    for (const person of this.people()) {
      const score = fuzzyScore(query, person.name);
      if (score > 0) {
        results.push({
          kind: 'person',
          id: person.id,
          zoneId: person.jumuiya.kanda_id,
          communityId: person.jumuiya_id,
          label: person.name,
          sub: `${person.jumuiya.name} · ${person.jumuiya.kanda?.name ?? ''}`.trim(),
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  });

  constructor() {
    void this.load();
  }

  private emptyDraft(): Draft {
    return { first_name: '', middle_name: '', last_name: '', gender: '', zone_role: '', community_role: '', dial: '+255', phone: '' };
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [zones, communities, people] = await Promise.all([
        this.parish.listKandas(),
        this.parish.listJumuiyas(),
        this.parish.listPeople(),
      ]);
      this.zones.set(zones);
      this.communities.set(communities);
      this.people.set(people);
    } catch (error) {
      this.flash('err', httpErrorMessage(error, translate('Imeshindwa kupakia data.')));
    } finally {
      this.loading.set(false);
    }
  }

  private leadersOf(people: DirectoryPerson[], column: 'zone_role' | 'community_role'): { role: Role; name: string }[] {
    return ROLE_OPTIONS.map((option) => {
      const holder = people.find((person) => person[column] === option.value);
      return holder ? { role: option.value, name: holder.name } : null;
    }).filter((entry): entry is { role: Role; name: string } => entry !== null);
  }

  protected roleLabel(role: Role | null | ''): string {
    if (!role) return 'Ordinary';
    const option = ROLE_OPTIONS.find((item) => item.value === role);
    return option ? (currentLang() === 'en' ? option.en : option.sw) : role;
  }

  protected flash(kind: 'ok' | 'err', text: string): void {
    this.notice.set({ kind, text });
  }

  // --- selection -----------------------------------------------------------

  protected pickZone(id: number): void {
    this.selectedZoneId.set(id);
    this.selectedCommunityId.set(null);
    this.highlightedId.set(null);
    this.zoneMenuOpen.set(false);
    this.cancelAdd();
  }

  protected pickCommunity(id: number): void {
    this.selectedCommunityId.set(id);
    this.highlightedId.set(null);
    this.communityMenuOpen.set(false);
    this.cancelAdd();
  }

  protected applySuggestion(suggestion: Suggestion): void {
    if (suggestion.kind === 'zone') {
      this.pickZone(suggestion.id);
    } else if (suggestion.kind === 'community') {
      this.selectedZoneId.set(suggestion.zoneId);
      this.selectedCommunityId.set(suggestion.id);
      this.highlightedId.set(null);
    } else {
      this.selectedZoneId.set(suggestion.zoneId);
      this.selectedCommunityId.set(suggestion.communityId);
      this.highlightedId.set(suggestion.id);
    }
    this.search.set('');
  }

  // --- add zone / community ------------------------------------------------

  protected openAddZone(): void {
    this.addingZone.set(true);
    this.addingCommunity.set(false);
    this.newName.set('');
    this.zoneMenuOpen.set(false);
  }

  protected openAddCommunity(): void {
    if (this.selectedZoneId() === null) return;
    this.addingCommunity.set(true);
    this.addingZone.set(false);
    this.newName.set('');
    this.communityMenuOpen.set(false);
  }

  protected async saveZone(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    try {
      const zone = await this.parish.createKanda({ name });
      this.zones.update((list) => [...list, { ...zone, jumuiyas_count: 0, members_count: 0 }]);
      this.addingZone.set(false);
      this.pickZone(zone.id);
      this.flash('ok', translate('Kanda "{name}" imeongezwa.', { name: zone.name }));
    } catch (error) {
      this.flash('err', httpErrorMessage(error, translate('Imeshindwa kuongeza kanda.')));
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveCommunity(): Promise<void> {
    const name = this.newName().trim();
    const zoneId = this.selectedZoneId();
    if (!name || zoneId === null || this.saving()) return;
    this.saving.set(true);
    try {
      const community = await this.parish.createJumuiya({ name, kanda_id: zoneId });
      const zone = this.selectedZone();
      this.communities.update((list) => [
        ...list,
        { ...community, kanda: zone ? { id: zone.id, name: zone.name } : undefined, members_count: 0 },
      ]);
      this.zones.update((list) =>
        list.map((item) => (item.id === zoneId ? { ...item, jumuiyas_count: (item.jumuiyas_count ?? 0) + 1 } : item)),
      );
      this.addingCommunity.set(false);
      this.pickCommunity(community.id);
      this.flash('ok', translate('Jumuiya "{name}" imeongezwa.', { name: community.name }));
    } catch (error) {
      this.flash('err', httpErrorMessage(error, translate('Imeshindwa kuongeza jumuiya.')));
    } finally {
      this.saving.set(false);
    }
  }

  // --- people --------------------------------------------------------------

  protected patchDraft(patch: Partial<Draft>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
  }

  protected startAdd(): void {
    this.editingId.set(null);
    this.draft.set(this.emptyDraft());
    this.adding.set(true);
    this.focusFirstCell();
  }

  private focusFirstCell(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => document.getElementById('entry-first')?.focus(), 0);
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.editingId.set(null);
  }

  protected editPerson(person: DirectoryPerson): void {
    this.editingId.set(person.id);
    this.adding.set(false);
    const dial = DIAL_CODES.find((code) => person.phone?.startsWith(code)) ?? '+255';
    this.draft.set({
      first_name: person.first_name,
      middle_name: person.middle_name ?? '',
      last_name: person.last_name ?? '',
      gender: person.gender ?? '',
      zone_role: person.zone_role ?? '',
      community_role: person.community_role ?? '',
      dial,
      phone: person.phone ? person.phone.slice(dial.length).trim() : '',
    });
  }

  private draftPayload() {
    const draft = this.draft();
    const phone = draft.phone.trim() ? `${draft.dial}${draft.phone.replace(/\s+/g, '')}` : null;
    return {
      first_name: draft.first_name.trim(),
      middle_name: draft.middle_name.trim() || null,
      last_name: draft.last_name.trim(),
      gender: draft.gender || null,
      zone_role: draft.zone_role || null,
      community_role: draft.community_role || null,
      phone,
    };
  }

  /** Saves the inline row. When adding, it reopens a fresh row so entry flows down the list. */
  protected async saveDraft(keepAdding = true): Promise<void> {
    const communityId = this.selectedCommunityId();
    if (communityId === null || this.saving()) return;
    const payload = this.draftPayload();
    if (!payload.first_name || !payload.last_name) {
      this.flash('err', translate('Jina la kwanza na la ukoo yanahitajika.'));
      return;
    }

    this.saving.set(true);
    try {
      const editingId = this.editingId();
      if (editingId !== null) {
        const { member } = await this.parish.updateJumuiyaMember(communityId, editingId, payload);
        this.people.update((list) => list.map((person) => (person.id === editingId ? this.withContext(member, person) : person)));
        this.editingId.set(null);
        this.flash('ok', translate('Mabadiliko yamehifadhiwa.'));
      } else {
        const { member } = await this.parish.addJumuiyaMember(communityId, payload);
        this.people.update((list) => [...list, this.withContext(member)]);
        this.bumpCount(communityId, 1);
        this.draft.set(this.emptyDraft());
        this.adding.set(keepAdding);
        if (keepAdding) this.focusFirstCell();
        this.flash('ok', translate('Mtu ameongezwa.'));
      }
    } catch (error) {
      this.flash('err', httpErrorMessage(error, translate('Imeshindwa kuhifadhi.')));
    } finally {
      this.saving.set(false);
    }
  }

  protected async removePerson(person: DirectoryPerson): Promise<void> {
    const ok = await this.confirm.ask({
      message: translate('Futa {name} kwenye orodha?', { name: person.name }),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await this.parish.deleteJumuiyaMember(person.jumuiya_id, person.id);
      this.people.update((list) => list.filter((item) => item.id !== person.id));
      this.bumpCount(person.jumuiya_id, -1);
      this.flash('ok', translate('{name} amefutwa.', { name: person.name }));
    } catch (error) {
      this.flash('err', httpErrorMessage(error, translate('Imeshindwa kufuta.')));
    }
  }

  /** Enter walks to the next cell; on the last cell it saves the row. */
  protected onEnter(event: Event, next: HTMLElement | null): void {
    event.preventDefault();
    if (next) {
      next.focus();
    } else {
      void this.saveDraft();
    }
  }

  private withContext(member: JumuiyaMember, previous?: DirectoryPerson): DirectoryPerson {
    const community = this.selectedCommunity();
    const zone = this.selectedZone();
    const jumuiya = previous?.jumuiya ?? {
      id: community?.id ?? 0,
      name: community?.name ?? '',
      kanda_id: zone?.id ?? 0,
      kanda: zone ? { id: zone.id, name: zone.name } : undefined,
    };
    return { ...member, jumuiya };
  }

  private bumpCount(communityId: number, by: number): void {
    const community = this.communities().find((item) => item.id === communityId);
    this.communities.update((list) =>
      list.map((item) => (item.id === communityId ? { ...item, members_count: (item.members_count ?? 0) + by } : item)),
    );
    if (community) {
      this.zones.update((list) =>
        list.map((item) => (item.id === community.kanda_id ? { ...item, members_count: (item.members_count ?? 0) + by } : item)),
      );
    }
  }
}
