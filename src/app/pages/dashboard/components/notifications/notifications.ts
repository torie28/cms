import { DatePipe, formatDate } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../../../core/auth';
import { ConfirmService } from '../../../../core/confirm';
import { httpErrorMessage } from '../../../../core/http-error';
import { I18nService, translate, TranslatePipe } from '../../../../core/i18n';
import {
  AMOUNT_PLACEHOLDER,
  audienceLabel,
  AudienceType,
  CHANNEL_LABELS,
  ContactBook,
  DATE_PLACEHOLDER,
  displayPhone,
  isMessageTopic,
  Message,
  MessageChannel,
  MessagePayload,
  MESSAGE_TOPICS,
  MessageTemplate,
  MessageTemplateKind,
  MessageTemplatePayload,
  MessageTopic,
  MessagesService,
  MessageStatus,
  messageTopicLabel,
  NAME_PLACEHOLDER,
  SmsBalance,
  normalizePhone,
  renderMessage,
  smsLength,
  STATUS_LABELS,
  TEMPLATE_KIND_LABELS,
  THANK_YOU_TOPICS,
} from '../../../../core/messages';
import { FilterPanel, withinDateRange } from '../../../../shared/filter-panel';
import { SmsBalanceCard } from '../../../../shared/sms-balance';
import { matchesSearch, SearchBox } from '../../../../shared/search-box';

type Tab = 'compose' | 'templates' | 'history';

interface Person {
  key: string;
  type: 'member' | 'user';
  id: number;
  name: string;
  phone: string | null;
  group: string;
}

interface SmsTarget {
  name: string | null;
  phone: string;
}

const PICKER_LIMIT = 60;

@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, SearchBox, FilterPanel, TranslatePipe, SmsBalanceCard],
  templateUrl: './notifications.html',
})
export class NotificationsPage {
  private readonly messages = inject(MessagesService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
  protected readonly canCreate = computed(() => this.auth.can('notifications', 'create'));

  protected readonly tab = signal<Tab>('compose');
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly audienceLabel = audienceLabel;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly placeholder = NAME_PLACEHOLDER;
  protected readonly amountPlaceholder = AMOUNT_PLACEHOLDER;
  protected readonly datePlaceholder = DATE_PLACEHOLDER;
  protected readonly topics = MESSAGE_TOPICS;
  protected readonly announcementTopics = MESSAGE_TOPICS.filter((topic) => topic.group === 'announcement');
  protected readonly offeringTopics = MESSAGE_TOPICS.filter((topic) => topic.group === 'offering');
  protected readonly thankYouTopics = THANK_YOU_TOPICS;
  protected readonly templateKinds: MessageTemplateKind[] = ['compose', 'thank_you'];
  protected readonly templateKindLabels = TEMPLATE_KIND_LABELS;
  protected readonly messageTopicLabel = messageTopicLabel;
  protected readonly displayPhone = displayPhone;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  protected readonly channels: { value: MessageChannel; label: string; hint: string }[] = [
    { value: 'sms', label: 'SMS', hint: 'Hufika kwenye simu ya kila mpokeaji mwenye namba.' },
    { value: 'app', label: 'Arifa ya mfumo', hint: 'Huonekana kwenye kengele ya watumiaji wa mfumo.' },
    { value: 'both', label: 'Zote mbili', hint: 'SMS kwa wote, pamoja na arifa kwa watumiaji wa mfumo.' },
  ];

  protected readonly audiences: { value: AudienceType; label: string; hint: string }[] = [
    { value: 'all', label: 'Wote waliosajiliwa', hint: 'Wanajumuiya wote na watumiaji wa mfumo' },
    { value: 'kanda', label: 'Kanda', hint: 'Wanajumuiya wa kanda ulizochagua. Majina yao yanachaguliwa yenyewe.' },
    { value: 'jumuiya', label: 'Jumuiya', hint: 'Wanajumuiya wa jumuiya ulizochagua. Majina yao yanachaguliwa yenyewe.' },
    { value: 'users', label: 'Watumiaji wa mfumo', hint: 'Wenye akaunti ya kuingia kwenye mfumo' },
    { value: 'custom', label: 'Watu maalum', hint: 'Chagua mmoja mmoja au andika namba' },
  ];

  // ---------- Compose ----------

  protected readonly contacts = signal<ContactBook | null>(null);
  protected readonly contactsLoading = signal(true);
  protected readonly channel = signal<MessageChannel>('sms');
  protected readonly audience = signal<AudienceType>('all');
  protected readonly selectedKandas = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedJumuiyas = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedUsers = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedPeople = signal<ReadonlySet<string>>(new Set());
  /** Members ticked inside the chosen kanda or jumuiya. Choosing a group ticks its members. */
  protected readonly selectedMembers = signal<ReadonlySet<number>>(new Set());
  protected readonly pickerSearch = signal('');
  protected readonly memberSearch = signal('');
  protected readonly jumuiyaKandaFilter = signal(0);
  protected readonly extraPhones = signal('');
  protected readonly topic = signal<MessageTopic | ''>('');
  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly selectedTemplateId = signal<number | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  // ---------- Templates ----------

  protected readonly templates = signal<MessageTemplate[]>([]);
  protected readonly templatesLoading = signal(true);
  protected readonly templateError = signal<string | null>(null);
  protected readonly templateNotice = signal<string | null>(null);
  protected readonly templateSaving = signal(false);
  protected readonly editingTemplateId = signal<number | null>(null);
  protected readonly templateKindFilter = signal<MessageTemplateKind | ''>('');
  protected readonly templateTopicFilter = signal<MessageTopic | ''>('');
  protected readonly templateForm = signal({
    topic: '' as MessageTopic | '',
    kind: 'compose' as MessageTemplateKind,
    name: '',
    body: '',
    is_default: true,
  });

  private readonly jumuiyaById = computed(
    () => new Map((this.contacts()?.jumuiyas ?? []).map((group) => [group.id, group])),
  );

  protected readonly membersPerJumuiya = computed(() => {
    const counts = new Map<number, number>();
    for (const member of this.contacts()?.members ?? []) {
      counts.set(member.jumuiya_id, (counts.get(member.jumuiya_id) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly kandaRows = computed(() => {
    const jumuiyas = this.contacts()?.jumuiyas ?? [];
    return (this.contacts()?.kandas ?? [])
      .map((kanda) => {
        const groups = jumuiyas.filter((group) => group.kanda_id === kanda.id);
        return {
          ...kanda,
          jumuiyas: groups.length,
          members: groups.reduce((total, group) => total + (this.membersPerJumuiya().get(group.id) ?? 0), 0),
        };
      })
      .filter((kanda) => matchesSearch(this.pickerSearch(), [kanda.name]));
  });

  /** Members who belong to the kanda or jumuiya currently selected. */
  protected readonly scopedMembers = computed(() => {
    const book = this.contacts();
    const audience = this.audience();
    if (!book || (audience !== 'kanda' && audience !== 'jumuiya')) {
      return [];
    }

    return book.members.filter((member) => {
      if (audience === 'kanda') {
        return this.selectedKandas().has(this.jumuiyaById().get(member.jumuiya_id)?.kanda_id ?? -1);
      }
      return this.selectedJumuiyas().has(member.jumuiya_id);
    });
  });

  private readonly matchingScopedMembers = computed(() =>
    this.scopedMembers().filter((member) =>
      matchesSearch(this.memberSearch(), [
        member.name,
        member.phone,
        this.jumuiyaById().get(member.jumuiya_id)?.name,
      ]),
    ),
  );

  protected readonly scopedMemberRows = computed(() => this.matchingScopedMembers().slice(0, PICKER_LIMIT));
  protected readonly hiddenScopedMembers = computed(() =>
    Math.max(0, this.matchingScopedMembers().length - PICKER_LIMIT),
  );

  /** People ticked inside a kanda or jumuiya. Names come from the member register. */
  protected readonly chosenMembers = computed(() =>
    this.scopedMembers().filter((member) => this.selectedMembers().has(member.id)),
  );

  protected readonly allScopedMembersSelected = computed(() => {
    const members = this.scopedMembers();
    return members.length > 0 && members.every((member) => this.selectedMembers().has(member.id));
  });

  protected readonly jumuiyaRows = computed(() => {
    const kandaId = this.jumuiyaKandaFilter();
    return (this.contacts()?.jumuiyas ?? [])
      .filter(
        (group) =>
          (kandaId === 0 || group.kanda_id === kandaId) &&
          matchesSearch(this.pickerSearch(), [group.name, group.kanda?.name]),
      )
      .map((group) => ({ ...group, members: this.membersPerJumuiya().get(group.id) ?? 0 }));
  });

  protected readonly userRows = computed(() =>
    (this.contacts()?.users ?? []).filter((user) =>
      matchesSearch(this.pickerSearch(), [user.name, user.phone, user.role.replaceAll('_', ' ')]),
    ),
  );

  private readonly people = computed<Person[]>(() => {
    const book = this.contacts();
    if (!book) {
      return [];
    }

    return [
      ...book.members.map((member) => ({
        key: `member:${member.id}`,
        type: 'member' as const,
        id: member.id,
        name: member.name,
        phone: member.phone,
        group: this.jumuiyaById().get(member.jumuiya_id)?.name ?? translate('Jumuiya'),
      })),
      ...book.users.map((user) => ({
        key: `user:${user.id}`,
        type: 'user' as const,
        id: user.id,
        name: user.name,
        phone: user.phone,
        group: translate('Mtumiaji wa mfumo'),
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));
  });

  private readonly matchingPeople = computed(() =>
    this.people().filter((person) =>
      matchesSearch(this.pickerSearch(), [person.name, person.phone, person.group]),
    ),
  );

  protected readonly personRows = computed(() => this.matchingPeople().slice(0, PICKER_LIMIT));
  protected readonly hiddenPeople = computed(() => Math.max(0, this.matchingPeople().length - PICKER_LIMIT));

  protected readonly chosenPeople = computed(() =>
    this.people().filter((person) => this.selectedPeople().has(person.key)),
  );

  protected readonly parsedPhones = computed(() => {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const entry of this.extraPhones().split(/[\s,;]+/).filter(Boolean)) {
      const phone = normalizePhone(entry);
      if (phone) {
        valid.push(phone);
      } else {
        invalid.push(entry);
      }
    }

    return { valid: [...new Set(valid)], invalid };
  });

  /** Same resolution rules as the API, so the summary shows exactly who will receive it. */
  protected readonly recipients = computed(() => {
    const book = this.contacts();
    const empty = { sms: [] as SmsTarget[], app: [] as { name: string }[], skipped: 0 };
    if (!book) {
      return empty;
    }

    let members: { name: string; phone: string | null }[] = [];
    let users: { name: string; phone: string | null }[] = [];
    let phones: string[] = [];

    switch (this.audience()) {
      case 'all':
        members = book.members;
        users = book.users;
        break;
      case 'kanda':
      case 'jumuiya':
        members = this.chosenMembers();
        break;
      case 'users': {
        const ids = this.selectedUsers();
        users = ids.size === 0 ? book.users : book.users.filter((user) => ids.has(user.id));
        break;
      }
      case 'custom': {
        const keys = this.selectedPeople();
        members = book.members.filter((member) => keys.has(`member:${member.id}`));
        users = book.users.filter((user) => keys.has(`user:${user.id}`));
        phones = this.parsedPhones().valid;
        break;
      }
    }

    const sms = new Map<string, SmsTarget>();
    let skipped = 0;
    const add = (name: string | null, raw: string | null) => {
      const phone = normalizePhone(raw);
      if (!phone) {
        skipped++;
      } else if (!sms.has(phone)) {
        sms.set(phone, { name, phone });
      }
    };

    members.forEach((member) => add(member.name, member.phone));
    users.forEach((user) => add(user.name, user.phone));
    phones.forEach((phone) => add(null, phone));

    const wantsSms = this.channel() !== 'app';
    const wantsApp = this.channel() !== 'sms';

    return {
      sms: wantsSms ? [...sms.values()] : [],
      app: wantsApp ? users.map((user) => ({ name: user.name })) : [],
      skipped: wantsSms ? skipped : 0,
    };
  });

  protected readonly renderMessage = renderMessage;
  protected readonly previewName = computed(
    () => this.chosenMembers()[0]?.name ?? this.recipients().sms[0]?.name ?? this.recipients().app[0]?.name ?? null,
  );
  protected readonly previewText = computed(() => renderMessage(this.body(), this.previewName()));
  protected readonly length = computed(() => smsLength(this.previewText()));

  /** Total SMS parts, accounting for names of different lengths when {jina} is used. */
  protected readonly estimatedParts = computed(() => {
    const targets = this.recipients().sms;
    const body = this.body();

    if (!body.includes(NAME_PLACEHOLDER)) {
      return smsLength(body).segments * targets.length;
    }

    return targets.reduce((total, target) => total + smsLength(renderMessage(body, target.name)).segments, 0);
  });

  protected readonly selectionMissing = computed(() => {
    switch (this.audience()) {
      case 'kanda':
      case 'jumuiya': {
        const groups = this.audience() === 'kanda' ? this.selectedKandas() : this.selectedJumuiyas();
        if (groups.size === 0) {
          return this.audience() === 'kanda'
            ? translate('Chagua angalau kanda moja.')
            : translate('Chagua angalau jumuiya moja.');
        }
        return this.chosenMembers().length === 0 ? translate('Chagua angalau mwanajumuiya mmoja.') : null;
      }
      case 'custom':
        return this.selectedPeople().size === 0 && this.parsedPhones().valid.length === 0
          ? translate('Chagua watu au andika angalau namba moja.')
          : null;
      default:
        return null;
    }
  });

  protected readonly blocker = computed(() => {
    const missing = this.selectionMissing();
    if (missing) {
      return missing;
    }
    if (!this.topic()) {
      return translate('Chagua ujumbe unahusu nini.');
    }
    if (!this.body().trim()) {
      return translate('Andika ujumbe.');
    }
    const { sms, app } = this.recipients();
    if (sms.length === 0 && app.length === 0) {
      return this.channel() === 'app'
        ? translate('Hakuna mtumiaji wa mfumo kati ya wapokeaji hawa.')
        : translate('Hakuna mpokeaji mwenye namba sahihi ya simu.');
    }
    return null;
  });

  // ---------- History ----------

  protected readonly balance = signal<SmsBalance | null>(null);
  protected readonly balanceLoading = signal(true);
  protected readonly alertEnabled = signal(false);
  protected readonly alertThreshold = signal('');
  protected readonly alertSaving = signal(false);
  protected readonly alertError = signal<string | null>(null);
  protected readonly alertSaved = signal(false);
  private readonly alertDirty = signal(false);
  protected readonly history = signal<Message[]>([]);
  protected readonly historyLoading = signal(true);
  protected readonly historyError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly channelFilter = signal<MessageChannel | ''>('');
  protected readonly topicFilter = signal<MessageTopic | ''>('');
  protected readonly statusFilter = signal<MessageStatus | ''>('');
  protected readonly senderFilter = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly oldestFirst = signal(false);

  protected readonly senders = computed(() => [...new Set(this.history().map((item) => item.sender))].sort());

  protected readonly totals = computed(() =>
    this.history().reduce(
      (sum, item) => ({
        messages: sum.messages + 1,
        sent: sum.sent + item.sms_sent,
        failed: sum.failed + item.sms_failed,
        parts: sum.parts + item.sms_segments,
        app: sum.app + item.app_count,
      }),
      { messages: 0, sent: 0, failed: 0, parts: 0, app: 0 },
    ),
  );

  protected readonly stats = computed(() => {
    const totals = this.totals();
    return [
      { label: 'Ujumbe uliotumwa', value: totals.messages, tone: '' },
      { label: 'SMS zilizotumwa', value: totals.sent, tone: 'text-positive' },
      { label: 'SMS zilizoshindwa', value: totals.failed, tone: totals.failed ? 'text-negative' : '' },
      { label: 'Arifa za mfumo', value: totals.app, tone: '' },
    ];
  });

  protected readonly activeFilters = computed(
    () =>
      [this.channelFilter(), this.topicFilter(), this.statusFilter(), this.senderFilter(), this.dateFrom(), this.dateTo()].filter(
        Boolean,
      ).length + (this.oldestFirst() ? 1 : 0),
  );

  protected readonly composeTemplates = computed(() => {
    const topic = this.topic();
    if (!topic) {
      return [];
    }
    return this.templates().filter((item) => item.topic === topic && item.kind === 'compose');
  });

  protected readonly filteredTemplates = computed(() => {
    const kind = this.templateKindFilter();
    const topic = this.templateTopicFilter();
    return this.templates().filter(
      (item) => (kind === '' || item.kind === kind) && (topic === '' || item.topic === topic),
    );
  });

  protected readonly templateFormTopics = computed(() => {
    const kind = this.templateForm().kind;
    return kind === 'thank_you'
      ? MESSAGE_TOPICS.filter((topic) => THANK_YOU_TOPICS.includes(topic.value))
      : MESSAGE_TOPICS;
  });

  protected readonly templateLength = computed(() => smsLength(this.templateForm().body));

  protected readonly filteredHistory = computed(() => {
    const channel = this.channelFilter();
    const topic = this.topicFilter();
    const status = this.statusFilter();
    const sender = this.senderFilter();
    const locale = this.i18n.dateLocale();

    return this.history()
      .filter(
        (item) =>
          (channel === '' || item.channel === channel) &&
          (topic === '' || item.topic === topic) &&
          (status === '' || item.status === status) &&
          (sender === '' || item.sender === sender) &&
          withinDateRange(formatDate(item.created_at, 'yyyy-MM-dd', locale), this.dateFrom(), this.dateTo()) &&
          matchesSearch(this.search(), [
            item.title,
            item.topic ? messageTopicLabel(item.topic) : '',
            item.body,
            item.sender,
            item.audience_label,
            audienceLabel(item.audience_label),
            translate(CHANNEL_LABELS[item.channel]),
            translate(STATUS_LABELS[item.status]),
            formatDate(item.created_at, 'd MMM y, HH:mm', locale),
          ]),
      )
      .sort((a, b) => (this.oldestFirst() ? a.id - b.id : b.id - a.id));
  });

  protected readonly filterSummary = computed(() =>
    this.search() || this.activeFilters() > 0
      ? translate('Ujumbe {shown} kati ya {total}', {
          shown: this.filteredHistory().length,
          total: this.history().length,
        })
      : '',
  );

  // ---------- Details ----------

  protected readonly viewing = signal<Message | null>(null);
  protected readonly viewLoading = signal(false);
  protected readonly retrying = signal(false);
  protected readonly viewError = signal<string | null>(null);
  protected readonly recipientSearch = signal('');
  protected readonly recipientFilter = signal<'' | 'sms' | 'app' | 'failed'>('');

  protected readonly filteredRecipients = computed(() => {
    const filter = this.recipientFilter();
    return (this.viewing()?.recipients ?? []).filter(
      (recipient) =>
        (filter === '' ||
          (filter === 'failed' ? recipient.status === 'failed' : recipient.channel === filter)) &&
        matchesSearch(this.recipientSearch(), [
          recipient.name,
          recipient.phone,
          recipient.group_name,
          recipient.error,
        ]),
    );
  });

  constructor() {
    effect(() => {
      if (!this.canCreate() && (this.tab() === 'compose' || this.tab() === 'templates')) {
        this.tab.set('history');
      }
    });

    afterNextRender(() => {
      void this.loadContacts();
      void this.loadHistory();
      void this.loadBalance();
      void this.loadTemplates();
    });
  }

  protected setTab(tab: Tab): void {
    if ((tab === 'compose' || tab === 'templates') && !this.canCreate()) {
      this.tab.set('history');
      return;
    }
    this.tab.set(tab);
  }

  protected setAudience(audience: AudienceType): void {
    this.audience.set(audience);
    this.pickerSearch.set('');
    this.memberSearch.set('');
    this.error.set(null);
  }

  protected toggleMember(id: number): void {
    this.selectedMembers.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected memberGroup(jumuiyaId: number): string {
    return this.jumuiyaById().get(jumuiyaId)?.name ?? translate('Jumuiya');
  }

  /** Ticks every member of the chosen groups, or clears them when All is already on. */
  protected toggleAllMembers(): void {
    this.setGroupMembers(
      this.audience() === 'kanda' ? 'kanda' : 'jumuiya',
      this.audience() === 'kanda' ? [...this.selectedKandas()] : [...this.selectedJumuiyas()],
      !this.allScopedMembersSelected(),
    );
  }

  protected toggle(target: 'kanda' | 'jumuiya' | 'user', id: number): void {
    const store = { kanda: this.selectedKandas, jumuiya: this.selectedJumuiyas, user: this.selectedUsers }[target];
    const selecting = !store().has(id);
    store.update((current) => {
      const next = new Set(current);
      if (selecting) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (target !== 'user') {
      this.setGroupMembers(target, [id], selecting);
    }
  }

  protected setJumuiyaKandaFilter(value: string): void {
    this.jumuiyaKandaFilter.set(Number(value) || 0);
  }

  protected togglePerson(key: string): void {
    this.selectedPeople.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  /** Selects every visible row, or clears them if they are all selected already. */
  protected toggleAllVisible(target: 'kanda' | 'jumuiya' | 'user'): void {
    const rows =
      target === 'kanda' ? this.kandaRows() : target === 'jumuiya' ? this.jumuiyaRows() : this.userRows();
    const store = { kanda: this.selectedKandas, jumuiya: this.selectedJumuiyas, user: this.selectedUsers }[target];
    const ids = rows.map((row) => row.id);
    const allSelected = ids.every((id) => store().has(id));

    store.update((current) => {
      const next = new Set(current);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
    if (target !== 'user') {
      this.setGroupMembers(target, ids, !allSelected);
    }
  }

  /** Adds or removes every member who belongs to the given kanda or jumuiya ids. */
  private setGroupMembers(target: 'kanda' | 'jumuiya', groupIds: number[], selected: boolean): void {
    const wanted = new Set(groupIds);
    const memberIds = (this.contacts()?.members ?? [])
      .filter((member) =>
        target === 'jumuiya'
          ? wanted.has(member.jumuiya_id)
          : wanted.has(this.jumuiyaById().get(member.jumuiya_id)?.kanda_id ?? -1),
      )
      .map((member) => member.id);

    this.selectedMembers.update((current) => {
      const next = new Set(current);
      memberIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  protected allVisibleSelected(target: 'kanda' | 'jumuiya' | 'user'): boolean {
    const rows =
      target === 'kanda' ? this.kandaRows() : target === 'jumuiya' ? this.jumuiyaRows() : this.userRows();
    const store = { kanda: this.selectedKandas, jumuiya: this.selectedJumuiyas, user: this.selectedUsers }[target];
    return rows.length > 0 && rows.every((row) => store().has(row.id));
  }

  protected insertPlaceholder(textarea: HTMLTextAreaElement): void {
    const start = textarea.selectionStart ?? this.body().length;
    const end = textarea.selectionEnd ?? start;
    const next = this.body().slice(0, start) + NAME_PLACEHOLDER + this.body().slice(end);
    this.body.set(next);

    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(start + NAME_PLACEHOLDER.length, start + NAME_PLACEHOLDER.length);
    });
  }

  /** Picks what the message is about, and fills a template when the text has not been edited. */
  protected async chooseTopic(value: MessageTopic): Promise<void> {
    if (this.topic() === value) {
      return;
    }

    const next = MESSAGE_TOPICS.find((item) => item.value === value);
    if (!next) {
      return;
    }

    const previous = MESSAGE_TOPICS.find((item) => item.value === this.topic());
    const current = this.body().trim();
    const previousDefault = this.defaultComposeBody(this.topic() || null, previous?.body ?? '');
    const nextDefault = this.defaultComposeBody(value, next.body);
    const untouched = current === '' || current === previousDefault.trim();
    let replace = untouched;

    if (nextDefault && !untouched && nextDefault.trim() !== current) {
      replace = await this.confirm.ask({
        message: translate('Badilisha ujumbe ulioandika ili uendane na mada hii?'),
        confirmLabel: 'Badilisha',
      });
    }

    this.topic.set(value);
    this.selectedTemplateId.set(null);
    this.error.set(null);

    if (replace && nextDefault) {
      this.applyComposeTemplate(value, nextDefault);
    } else if (replace && untouched) {
      this.body.set('');
    }
  }

  /** Applies a saved compose template chosen from the select (value is the template id). */
  protected async onComposeTemplateChange(value: string): Promise<void> {
    const id = Number(value) || 0;
    if (!id) {
      this.selectedTemplateId.set(null);
      return;
    }
    await this.applySavedTemplate(id);
  }

  /** Applies a saved compose template to the message body, optionally switching to Compose. */
  protected async applySavedTemplate(id: number, switchToCompose = false): Promise<void> {
    const template = this.templates().find((item) => item.id === id && item.kind === 'compose');
    if (!template) {
      return;
    }

    if (switchToCompose) {
      this.tab.set('compose');
    }

    const current = this.body().trim();
    const untouched = current === '' || current === this.defaultComposeBody(this.topic() || template.topic).trim();
    let replace = untouched;

    if (!untouched && template.body.trim() !== current) {
      replace = await this.confirm.ask({
        message: translate('Badilisha ujumbe ulioandika kwa kiolezo hiki?'),
        confirmLabel: 'Badilisha',
      });
    }

    if (!replace) {
      return;
    }

    this.topic.set(template.topic);
    this.applyComposeTemplate(template.topic, template.body, template.id);
  }

  private applyComposeTemplate(topic: MessageTopic, body: string, templateId: number | null = null): void {
    const saved = this.templates().find(
      (item) =>
        item.topic === topic &&
        item.kind === 'compose' &&
        (templateId === null ? item.is_default : item.id === templateId),
    );
    this.selectedTemplateId.set(saved?.id ?? templateId);
    this.body.set(body);
  }

  /** Preferred body: saved default compose template, else the built-in topic text. */
  private defaultComposeBody(topic: MessageTopic | null, fallback = ''): string {
    if (!topic) {
      return fallback ? translate(fallback) : '';
    }
    const saved = this.templates().find(
      (item) => item.topic === topic && item.kind === 'compose' && item.is_default,
    );
    if (saved) {
      return saved.body;
    }
    const builtIn = MESSAGE_TOPICS.find((item) => item.value === topic)?.body ?? fallback;
    return builtIn ? translate(builtIn) : '';
  }

  /** A title the sender wrote, when it is not just the subject name. */
  protected customTitle(message: Pick<Message, 'title' | 'topic'>): string | null {
    const title = message.title?.trim();
    if (!title || title === messageTopicLabel(message.topic)) {
      return null;
    }
    return title;
  }

  protected resetCompose(): void {
    this.topic.set('');
    this.title.set('');
    this.body.set('');
    this.selectedTemplateId.set(null);
    this.extraPhones.set('');
    this.selectedKandas.set(new Set());
    this.selectedJumuiyas.set(new Set());
    this.selectedUsers.set(new Set());
    this.selectedPeople.set(new Set());
    this.selectedMembers.set(new Set());
    this.memberSearch.set('');
    this.error.set(null);
  }

  protected async loadTemplates(): Promise<void> {
    this.templatesLoading.set(true);
    this.templateError.set(null);
    try {
      this.templates.set(await this.messages.templates());
    } catch (error) {
      this.templateError.set(httpErrorMessage(error, translate('Imeshindwa kupakia violezo.')));
    } finally {
      this.templatesLoading.set(false);
    }
  }

  protected resetTemplateForm(): void {
    this.editingTemplateId.set(null);
    this.templateForm.set({
      topic: '',
      kind: 'compose',
      name: '',
      body: '',
      is_default: true,
    });
    this.templateError.set(null);
  }

  protected editTemplate(template: MessageTemplate): void {
    this.editingTemplateId.set(template.id);
    this.templateForm.set({
      topic: template.topic,
      kind: template.kind,
      name: template.name,
      body: template.body,
      is_default: template.is_default,
    });
    this.templateError.set(null);
    this.templateNotice.set(null);
    this.tab.set('templates');
  }

  protected setTemplateField<K extends keyof MessageTemplatePayload>(
    field: K,
    value: MessageTemplatePayload[K],
  ): void {
    this.templateForm.update((current) => {
      const next = { ...current, [field]: value };
      if (field === 'kind' && value === 'thank_you' && next.topic && !THANK_YOU_TOPICS.includes(next.topic)) {
        next.topic = '';
      }
      return next;
    });
  }

  protected insertTemplatePlaceholder(token: string, textarea: HTMLTextAreaElement): void {
    const start = textarea.selectionStart ?? this.templateForm().body.length;
    const end = textarea.selectionEnd ?? start;
    const body = this.templateForm().body;
    this.setTemplateField('body', body.slice(0, start) + token + body.slice(end));
    queueMicrotask(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  protected async saveTemplate(): Promise<void> {
    const form = this.templateForm();
    if (!form.topic || !form.name.trim() || !form.body.trim() || this.templateSaving()) {
      this.templateError.set(
        !form.topic
          ? translate('Chagua mada ya kiolezo.')
          : !form.name.trim()
            ? translate('Andika jina la kiolezo.')
            : translate('Andika maandishi ya kiolezo.'),
      );
      return;
    }

    const payload: MessageTemplatePayload = {
      topic: form.topic,
      kind: form.kind,
      name: form.name.trim(),
      body: form.body.trim(),
      is_default: form.is_default,
    };

    this.templateSaving.set(true);
    this.templateError.set(null);
    this.templateNotice.set(null);
    try {
      const id = this.editingTemplateId();
      if (id) {
        await this.messages.updateTemplate(id, payload);
        this.templateNotice.set(translate('Kiolezo kimehifadhiwa.'));
      } else {
        await this.messages.createTemplate(payload);
        this.templateNotice.set(translate('Kiolezo kimeundwa.'));
      }
      await this.loadTemplates();
      this.resetTemplateForm();
    } catch (error) {
      this.templateError.set(httpErrorMessage(error, translate('Imeshindwa kuhifadhi kiolezo.')));
    } finally {
      this.templateSaving.set(false);
    }
  }

  protected async deleteTemplate(template: MessageTemplate): Promise<void> {
    if (template.is_system) {
      return;
    }
    const ok = await this.confirm.ask({
      message: translate('Futa kiolezo “{name}”?', { name: template.name }),
      confirmLabel: 'Futa',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    this.templateError.set(null);
    try {
      await this.messages.deleteTemplate(template.id);
      if (this.editingTemplateId() === template.id) {
        this.resetTemplateForm();
      }
      await this.loadTemplates();
      this.templateNotice.set(translate('Kiolezo kimefutwa.'));
    } catch (error) {
      this.templateError.set(httpErrorMessage(error, translate('Imeshindwa kufuta kiolezo.')));
    }
  }

  protected async send(): Promise<void> {
    const blocker = this.blocker();
    if (blocker || this.sending()) {
      this.error.set(blocker);
      return;
    }

    const { sms, app } = this.recipients();
    const [first, second] = [
      sms.length ? translate('SMS kwa namba {count} (vipande ~{parts})', { count: sms.length, parts: this.estimatedParts() }) : '',
      app.length ? translate('arifa kwa watumiaji {count}', { count: app.length }) : '',
    ].filter(Boolean);
    const question = second
      ? translate('Tuma {first} na {second}?', { first, second })
      : translate('Tuma {first}?', { first });

    if (!(await this.confirm.ask({ message: question, confirmLabel: 'Tuma' })) || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.error.set(null);
    this.notice.set(null);

    try {
      const sent = await this.messages.send(this.payload());
      this.history.update((current) => [sent, ...current]);
      this.notice.set(this.outcome(sent));
      this.resetCompose();
      void this.loadBalance();
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kutuma ujumbe huo.'));
    } finally {
      this.sending.set(false);
    }
  }

  protected setAlertEnabled(enabled: boolean): void {
    this.alertEnabled.set(enabled);
    this.alertDirty.set(true);
    this.alertSaved.set(false);
    this.alertError.set(null);
  }

  protected setAlertThreshold(value: string): void {
    this.alertThreshold.set(value);
    this.alertDirty.set(true);
    this.alertSaved.set(false);
    this.alertError.set(null);
  }

  protected async saveAlert(): Promise<void> {
    if (this.alertSaving()) {
      return;
    }

    const enabled = this.alertEnabled();
    const raw = this.alertThreshold().trim();
    const threshold = raw === '' ? null : Number(raw);

    if (
      (raw !== '' && (threshold === null || !Number.isInteger(threshold) || threshold < 0 || threshold > 1_000_000)) ||
      (enabled && threshold === null)
    ) {
      this.alertError.set(translate('Weka idadi kamili ya SMS, kuanzia sifuri.'));
      return;
    }

    this.alertSaving.set(true);
    this.alertError.set(null);
    this.alertSaved.set(false);

    try {
      const updated = await this.messages.saveAlert({ enabled, threshold });
      this.balance.set(updated);
      this.alertDirty.set(false);
      this.seedAlert(updated);
      this.alertSaved.set(true);
    } catch (error) {
      this.alertError.set(httpErrorMessage(error, 'Imeshindwa kuhifadhi kikomo cha salio.'));
    } finally {
      this.alertSaving.set(false);
    }
  }

  protected async loadBalance(): Promise<void> {
    this.balanceLoading.set(true);

    try {
      const balance = await this.messages.balance();
      this.balance.set(balance);
      this.seedAlert(balance);
    } catch (error) {
      this.balance.set({
        driver: '',
        provider: '',
        sender_id: '',
        test_mode: false,
        available: null,
        rate: null,
        error: httpErrorMessage(error, 'Imeshindwa kupakia salio la SMS.'),
      });
    } finally {
      this.balanceLoading.set(false);
    }
  }

  private seedAlert(balance: SmsBalance): void {
    if (this.alertDirty()) {
      return;
    }

    const alert = balance.alert;
    this.alertEnabled.set(alert?.enabled ?? false);
    this.alertThreshold.set(alert?.threshold != null ? String(alert.threshold) : '');
  }

  protected async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    this.historyError.set(null);

    try {
      this.history.set(await this.messages.list());
    } catch (error) {
      this.historyError.set(httpErrorMessage(error, 'Imeshindwa kupakia historia ya ujumbe.'));
    } finally {
      this.historyLoading.set(false);
    }
  }

  protected clearFilters(): void {
    this.channelFilter.set('');
    this.topicFilter.set('');
    this.statusFilter.set('');
    this.senderFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.oldestFirst.set(false);
  }

  protected setChannelFilter(value: string): void {
    this.channelFilter.set(value === 'sms' || value === 'app' || value === 'both' ? value : '');
  }

  protected setTopicFilter(value: string): void {
    this.topicFilter.set(isMessageTopic(value) ? value : '');
  }

  protected setStatusFilter(value: string): void {
    this.statusFilter.set(value in STATUS_LABELS ? (value as MessageStatus) : '');
  }

  protected async openView(message: Message): Promise<void> {
    this.viewing.set(message);
    this.viewError.set(null);
    this.recipientSearch.set('');
    this.recipientFilter.set('');
    this.viewLoading.set(true);

    try {
      this.viewing.set(await this.messages.get(message.id));
    } catch (error) {
      this.viewError.set(httpErrorMessage(error, 'Imeshindwa kupakia wapokeaji.'));
    } finally {
      this.viewLoading.set(false);
    }
  }

  protected closeView(): void {
    if (!this.retrying()) {
      this.viewing.set(null);
    }
  }

  protected async retry(message: Message): Promise<void> {
    if (this.retrying()) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: translate('Tuma tena SMS {failed} zilizoshindwa?', { failed: message.sms_failed }),
      confirmLabel: 'Tuma tena',
    });
    if (!confirmed || this.retrying()) {
      return;
    }

    this.retrying.set(true);
    this.viewError.set(null);

    try {
      const updated = await this.messages.retry(message.id);
      this.viewing.set(updated);
      this.history.update((current) =>
        current.map((item) => (item.id === updated.id ? { ...updated, recipients: undefined } : item)),
      );
    } catch (error) {
      this.viewError.set(httpErrorMessage(error, 'Imeshindwa kutuma tena.'));
    } finally {
      this.retrying.set(false);
    }
  }

  /** Reuses an old message as the starting point for a new one. */
  protected sendAgain(message: Message): void {
    this.viewing.set(null);
    this.resetCompose();
    this.channel.set(message.channel);
    this.topic.set(isMessageTopic(message.topic) ? message.topic : '');
    this.title.set(this.customTitle(message) ?? '');
    this.body.set(message.body);
    this.tab.set('compose');
  }

  protected statusClass(status: MessageStatus): string {
    switch (status) {
      case 'sent':
        return 'bg-positive/10 text-positive';
      case 'failed':
        return 'bg-negative/10 text-negative';
      default:
        return 'bg-brass-tint text-brass-strong';
    }
  }

  protected recipientTypeLabel(type: string): string {
    return translate(type === 'member' ? 'Mwanajumuiya' : type === 'user' ? 'Mtumiaji' : 'Namba');
  }

  private async loadContacts(): Promise<void> {
    this.contactsLoading.set(true);

    try {
      this.contacts.set(await this.messages.contacts());
    } catch (error) {
      this.error.set(httpErrorMessage(error, 'Imeshindwa kupakia orodha ya wapokeaji.'));
    } finally {
      this.contactsLoading.set(false);
    }
  }

  private payload(): MessagePayload {
    const base = {
      channel: this.channel(),
      audience: this.audience(),
      topic: this.topic() as MessageTopic,
      title: this.title().trim(),
      body: this.body(),
    };
    const keys = [...this.selectedPeople()];
    const idsOf = (type: string) =>
      keys.filter((key) => key.startsWith(`${type}:`)).map((key) => Number(key.split(':')[1]));

    switch (this.audience()) {
      case 'kanda':
        return {
          ...base,
          kanda_ids: [...this.selectedKandas()],
          member_ids: this.chosenMembers().map((member) => member.id),
        };
      case 'jumuiya':
        return {
          ...base,
          jumuiya_ids: [...this.selectedJumuiyas()],
          member_ids: this.chosenMembers().map((member) => member.id),
        };
      case 'users':
        return { ...base, user_ids: [...this.selectedUsers()] };
      case 'custom':
        return {
          ...base,
          member_ids: idsOf('member'),
          user_ids: idsOf('user'),
          phones: this.parsedPhones().valid,
        };
      default:
        return base;
    }
  }

  private outcome(message: Message): string {
    const parts: string[] = [];
    if (message.sms_count) {
      parts.push(translate('SMS {sent} kati ya {total} zimetumwa', { sent: message.sms_sent, total: message.sms_count }));
    }
    if (message.sms_failed) {
      parts.push(
        translate('{failed} zimeshindwa (unaweza kuzituma tena kwenye Historia)', { failed: message.sms_failed }),
      );
    }
    if (message.app_count) {
      parts.push(translate('arifa {count} zimewafikia watumiaji wa mfumo', { count: message.app_count }));
    }
    return translate('Ujumbe umetumwa: {details}.', { details: parts.join(', ') });
  }
}
