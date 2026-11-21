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
import { PdfSection, savePdf, slug } from '../../../../core/spreadsheet';

/** Phone country codes offered in the picker; Tanzania is the default. */
const DIAL_CODES = ['+255', '+254', '+256', '+257', '+250', '+260', '+265', '+1', '+44', '+971', '+91'];

/** 'all' means the whole parish / the whole zone — statistics only, no name list. */
type Selection = number | 'all';

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

interface PersonHit {
  id: number;
  zoneId: number;
  communityId: number;
  label: string;
  sub: string;
  score: number;
}

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

  // 'all' = show aggregate statistics with no name list. The default view is the whole parish.
  protected readonly selectedZoneId = signal<Selection>('all');
  protected readonly selectedCommunityId = signal<Selection>('all');
  protected readonly search = signal('');
  protected readonly highlightedId = signal<number | null>(null);
  protected readonly notice = signal<{ kind: 'ok' | 'err'; text: string } | null>(null);
  protected readonly saving = signal(false);

  // Dropdown state, each with its own filter box.
  protected readonly zoneMenuOpen = signal(false);
  protected readonly communityMenuOpen = signal(false);
  protected readonly zoneQuery = signal('');
  protected readonly communityQuery = signal('');
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

  /** What the page is focused on: the whole parish, one zone, or one community. */
  protected readonly scope = computed<'all' | 'zone' | 'community'>(() => {
    if (this.selectedZoneId() === 'all') return 'all';
    if (this.selectedCommunityId() === 'all') return 'zone';
    return 'community';
  });

  protected readonly sortedZones = computed(() =>
    [...this.zones()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly zoneCommunities = computed(() => {
    const zoneId = this.selectedZoneId();
    if (zoneId === 'all') return [];
    return this.communities()
      .filter((community) => community.kanda_id === zoneId)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Dropdown lists narrowed by their own search box (same neutral fuzzy match). */
  protected readonly filteredZones = computed(() => this.narrow(this.sortedZones(), this.zoneQuery()));
  protected readonly filteredCommunities = computed(() =>
    this.narrow(this.zoneCommunities(), this.communityQuery()),
  );

  protected readonly selectedZone = computed(() => {
    const id = this.selectedZoneId();
    return id === 'all' ? null : (this.zones().find((zone) => zone.id === id) ?? null);
  });

  protected readonly selectedCommunity = computed(() => {
    const id = this.selectedCommunityId();
    return id === 'all' ? null : (this.communities().find((community) => community.id === id) ?? null);
  });

  protected readonly communityPeople = computed(() => {
    const id = this.selectedCommunityId();
    if (id === 'all') return [];
    return this.sortedPeople(id);
  });

  /** Whole-parish totals, shown when no specific zone is picked. */
  protected readonly parishStats = computed(() => {
    const people = this.people();
    return {
      zones: this.zones().length,
      communities: this.communities().length,
      people: people.length,
      male: people.filter((person) => person.gender === 'male').length,
      female: people.filter((person) => person.gender === 'female').length,
    };
  });

  protected readonly zoneStats = computed(() => {
    const zone = this.selectedZone();
    if (!zone) return null;
    const inZone = this.people().filter((person) => person.jumuiya.kanda_id === zone.id);
    return {
      communities: this.zoneCommunities().length,
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

  /** The search bar finds people only; zones and communities are searched inside their dropdowns. */
  protected readonly suggestions = computed<PersonHit[]>(() => {
    const query = this.search().trim();
    if (query.length < 2) return [];
    return this.people()
      .map((person) => ({ person, score: fuzzyScore(query, person.name) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ person, score }) => ({
        id: person.id,
        zoneId: person.jumuiya.kanda_id,
        communityId: person.jumuiya_id,
        label: person.name,
        sub: `${person.jumuiya.name} · ${person.jumuiya.kanda?.name ?? ''}`.trim(),
        score,
      }));
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

  private narrow<T extends { name: string }>(list: T[], query: string): T[] {
    const q = query.trim();
    if (!q) return list;
    return list
      .map((item) => ({ item, score: fuzzyScore(q, item.name) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((hit) => hit.item);
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

  protected genderLabel(gender: string | null): string {
    return gender === 'male' ? translate('Mwanaume') : gender === 'female' ? translate('Mwanamke') : '';
  }

  private sortedPeople(communityId: number): DirectoryPerson[] {
    return this.people()
      .filter((person) => person.jumuiya_id === communityId)
      .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? '') || a.first_name.localeCompare(b.first_name));
  }

  /** PDF of the picked community: its numbered people with roles and phones. */
  protected async exportCommunityPdf(): Promise<void> {
    const community = this.selectedCommunity();
    if (!community) return;
    const people = this.communityPeople();
    const section: PdfSection = {
      head: ['#', translate('Jina'), translate('Jinsia'), translate('Wadhifa – Kanda'), translate('Wadhifa – Jumuiya'), translate('Simu')],
      rows: people.map((person, index) => [
        String(index + 1),
        person.name,
        this.genderLabel(person.gender),
        this.roleLabel(person.zone_role),
        this.roleLabel(person.community_role),
        person.phone ?? '',
      ]),
    };
    await savePdf(
      community.name,
      [this.selectedZone()?.name, translate('Orodha ya wanajumuiya')].filter(Boolean).join(' · '),
      [section],
      `${slug(community.name, 'jumuiya')}.pdf`,
      false,
    );
  }

  /** PDF of the whole zone: a summary, then each community's people. */
  protected async exportZonePdf(): Promise<void> {
    const zone = this.selectedZone();
    const stats = this.zoneStats();
    if (!zone || !stats) return;

    const sections: PdfSection[] = [
      {
        heading: translate('Muhtasari'),
        head: [translate('Kipengele'), translate('Idadi')],
        rows: [
          [translate('Jumuiya'), String(stats.communities)],
          [translate('Watu'), String(stats.people)],
          [translate('Wanaume'), String(stats.male)],
          [translate('Wanawake'), String(stats.female)],
        ],
        firstColumnWidth: 160,
      },
      ...this.zoneCommunities().map((community) => ({
        heading: community.name,
        head: ['#', translate('Jina'), translate('Jinsia'), translate('Wadhifa – Jumuiya'), translate('Simu')],
        rows: this.sortedPeople(community.id).map((person, index) => [
          String(index + 1),
          person.name,
          this.genderLabel(person.gender),
          this.roleLabel(person.community_role),
          person.phone ?? '',
        ]),
        firstColumnWidth: 28,
      })),
    ];

    await savePdf(zone.name, translate('Taarifa ya kanda'), sections, `${slug(zone.name, 'kanda')}.pdf`, false);
  }

  protected flash(kind: 'ok' | 'err', text: string): void {
    this.notice.set({ kind, text });
  }

  // --- selection -----------------------------------------------------------

  protected pickAllZones(): void {
    this.selectedZoneId.set('all');
    this.selectedCommunityId.set('all');
    this.highlightedId.set(null);
    this.zoneMenuOpen.set(false);
    this.zoneQuery.set('');
    this.cancelAdd();
  }

  protected pickZone(id: number): void {
    this.selectedZoneId.set(id);
    this.selectedCommunityId.set('all');
    this.highlightedId.set(null);
    this.zoneMenuOpen.set(false);
    this.zoneQuery.set('');
    this.communityQuery.set('');
    this.cancelAdd();
  }

  protected pickAllCommunities(): void {
    this.selectedCommunityId.set('all');
    this.highlightedId.set(null);
    this.communityMenuOpen.set(false);
    this.communityQuery.set('');
    this.cancelAdd();
  }

  protected pickCommunity(id: number): void {
    this.selectedCommunityId.set(id);
    this.highlightedId.set(null);
    this.communityMenuOpen.set(false);
    this.communityQuery.set('');
    this.cancelAdd();
  }

  protected applySuggestion(hit: PersonHit): void {
    this.selectedZoneId.set(hit.zoneId);
    this.selectedCommunityId.set(hit.communityId);
    this.highlightedId.set(hit.id);
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
    if (this.selectedZoneId() === 'all') return;
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
    if (!name || zoneId === 'all' || this.saving()) return;
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
    if (communityId === 'all' || this.saving()) return;
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
