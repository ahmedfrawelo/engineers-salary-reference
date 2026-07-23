import { OverlayModule, type ConnectedPosition } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppIconDirective } from '@shared/icons/app-icon.directive';
import { APP_ICON_NAME_OPTIONS } from '@shared/icons/app-icon.registry';

type EmojiIconChoice = {
  value: string;
  label: string;
  keywords: string;
  category: string;
};

const DEFAULT_EMOJI_VALUE = iconValue('bookmark');
const RECENT_STORAGE_KEY = 'engineers-salary-reference.shared.emojiIconPicker.recent.v1';
const MAX_RECENT_EMOJI = 36;

const CURATED_EMOJI_CHOICES: EmojiIconChoice[] = [
  { value: iconValue('bookmark'), label: 'Bookmark', keywords: 'bookmark save mark code price code save', category: 'mep' },
  { value: iconValue('tag'), label: 'Tag', keywords: 'tag label code category price code', category: 'mep' },
  { value: iconValue('check2-circle'), label: 'Approved', keywords: 'approved check done valid verified', category: 'mep' },
  { value: iconValue('bookmark-star'), label: 'Favorite', keywords: 'star favorite important featured', category: 'mep' },
  { value: iconValue('bullseye'), label: 'Target', keywords: 'target scope goal objective', category: 'mep' },
  { value: iconValue('pin-angle'), label: 'Pin', keywords: 'pin pinned important marker', category: 'mep' },
  { value: iconValue('flag'), label: 'Flag', keywords: 'flag marker milestone priority', category: 'mep' },
  { value: iconValue('geo-alt'), label: 'Location', keywords: 'location pin site area zone', category: 'mep' },
  { value: iconValue('gear'), label: 'Mechanical', keywords: 'gear mechanical machine equipment pump', category: 'mep' },
  { value: iconValue('hammer'), label: 'Tools', keywords: 'tools toolbox maintenance service repair wrench mechanical', category: 'mep' },
  { value: iconValue('sliders'), label: 'Controls', keywords: 'controls sliders settings testing commissioning', category: 'mep' },
  { value: iconValue('box-seam'), label: 'Material', keywords: 'box package material supply item', category: 'mep' },
  { value: iconValue('dropbox'), label: 'Package', keywords: 'package box supply delivery', category: 'mep' },
  { value: iconValue('cloud'), label: 'Water', keywords: 'water pump plumbing pipe chilled liquid drop', category: 'mep' },
  { value: iconValue('brightness'), label: 'Cooling', keywords: 'cooling ac air conditioning hvac chilled', category: 'mep' },
  { value: iconValue('activity'), label: 'Airflow', keywords: 'air fan ventilation hvac duct airflow', category: 'mep' },
  { value: iconValue('lightning-charge'), label: 'Power', keywords: 'electric electrical power lightning voltage', category: 'mep' },
  { value: iconValue('brightness-alt-high'), label: 'Lighting', keywords: 'light bulb lighting electrical lux', category: 'mep' },
  { value: iconValue('link-45deg'), label: 'Cable', keywords: 'plug electrical power cable socket link', category: 'mep' },
  { value: iconValue('database'), label: 'UPS', keywords: 'battery ups power electrical backup', category: 'mep' },
  { value: iconValue('fire'), label: 'Fire', keywords: 'fire alarm safety sprinkler firefighting', category: 'mep' },
  { value: iconValue('shield'), label: 'Safety', keywords: 'safety shield protection security', category: 'mep' },
  { value: iconValue('alarm'), label: 'Alarm', keywords: 'alarm warning fire safety siren', category: 'mep' },
  { value: iconValue('wifi'), label: 'Network', keywords: 'network signal wifi low current bms', category: 'mep' },
  { value: iconValue('camera-video'), label: 'CCTV', keywords: 'camera cctv security low current video', category: 'mep' },
  { value: iconValue('cpu'), label: 'System', keywords: 'computer system bms it monitor cpu', category: 'mep' },
  { value: iconValue('building'), label: 'Building', keywords: 'building tower project civil office', category: 'mep' },
  { value: iconValue('home'), label: 'Area', keywords: 'home building area zone room', category: 'mep' },
  { value: iconValue('truck'), label: 'Supply', keywords: 'delivery truck supply logistics material', category: 'mep' },
  { value: iconValue('clipboard-check'), label: 'BOQ', keywords: 'boq clipboard checklist list estimate', category: 'mep' },
  { value: iconValue('receipt'), label: 'Receipt', keywords: 'receipt invoice price cost', category: 'mep' },
  { value: iconValue('cash-coin'), label: 'Cost', keywords: 'money cost price cash budget', category: 'mep' },
  { value: iconValue('bar-chart'), label: 'Estimate', keywords: 'chart estimate quantity cost report', category: 'mep' },
  { value: iconValue('table'), label: 'Table', keywords: 'table boq rows quantity breakdown', category: 'mep' },
  { value: iconValue('layout-three-columns'), label: 'Breakdown', keywords: 'columns breakdown work packages layout', category: 'mep' },
  { value: iconValue('file-earmark-text'), label: 'Document', keywords: 'document spec sheet report', category: 'mep' },
  { value: iconValue('journal-text'), label: 'Note', keywords: 'memo note description write', category: 'mep' },
  { value: iconValue('search'), label: 'Review', keywords: 'search inspect review check', category: 'mep' },
  { value: iconValue('lock'), label: 'Locked', keywords: 'lock locked secure approved', category: 'mep' },
  { value: iconValue('unlock'), label: 'Open', keywords: 'unlock open editable', category: 'mep' }
];

const APP_ICON_CHOICES = buildAppIconChoices(CURATED_EMOJI_CHOICES);
let generatedEmojiChoicesCache: EmojiIconChoice[] | null = null;
let flagEmojiChoicesCache: EmojiIconChoice[] | null = null;
let allEmojiChoicesCache: EmojiIconChoice[] | null = null;
let emojiByValueCache: Map<string, EmojiIconChoice> | null = null;

@Component({
  selector: 'app-emoji-icon-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, AppIconDirective],
  templateUrl: './emoji-icon-picker.component.html',
  styleUrls: ['./emoji-icon-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmojiIconPickerComponent implements OnChanges {
  @Input() value = DEFAULT_EMOJI_VALUE;
  @Input() disabled = false;
  @Input() label = 'Choose icon';
  @Input() pageSize = 40;
  @Input() recommendationText = '';
  @Input() autoSelectRecommendation = false;
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  searchDraft = '';
  category = 'all';
  page = 0;
  private recentValues: string[] = readRecentEmojiValues();
  private lastAutoSelectedValue = '';
  private userSelectedValue = false;
  private cachedChoicesKey = '';
  private cachedChoices: EmojiIconChoice[] = [];

  readonly categories = [
    { id: 'all', label: 'All' },
    { id: 'suggested', label: 'Suggested' },
    { id: 'recent', label: 'Recent' },
    { id: 'mep', label: 'MEP' }
  ];
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetX: -4, offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetX: 12, offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetX: -4, offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetX: 12, offsetY: -6 }
  ];

  selectedSymbol(): string {
    return emojiIconSymbol(this.value) || emojiIconToken(this.value) || 'Icon';
  }

  selectedIconName(): string {
    return iconNameFromValue(this.value);
  }

  selectedLabel(): string {
    return findEmojiChoiceByValue(this.value)?.label || 'Icon';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      const nextValue = String(changes['value'].currentValue || '');
      if (nextValue && nextValue !== this.lastAutoSelectedValue) {
        this.userSelectedValue = true;
      }
    }

    if (changes['recommendationText'] || changes['autoSelectRecommendation']) {
      this.invalidateChoices();
      this.autoSelectSuggestedIcon();
    }
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }
    this.open = !this.open;
    this.page = 0;
  }

  close(): void {
    this.open = false;
  }

  select(value: string): void {
    this.value = value;
    this.userSelectedValue = true;
    this.remember(value);
    this.valueChange.emit(value);
    this.close();
    this.searchDraft = '';
    this.category = 'all';
    this.page = 0;
    this.invalidateChoices();
  }

  setCategory(category: string): void {
    this.category = this.categories.some(option => option.id === category) ? category : 'all';
    this.page = 0;
    this.invalidateChoices();
  }

  onSearchChange(): void {
    this.page = 0;
    this.invalidateChoices();
  }

  visibleChoices(): EmojiIconChoice[] {
    const start = this.page * this.pageSize;
    return this.filteredChoices().slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredChoices().length / this.pageSize));
  }

  pageLabel(): string {
    const total = this.filteredChoices().length;
    if (!total) {
      return '0 icons';
    }
    return `${this.page + 1} / ${this.totalPages()}`;
  }

  previousPage(): void {
    this.page = Math.max(0, this.page - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages() - 1, this.page + 1);
  }

  iconSymbol(value: string): string {
    return emojiIconSymbol(value);
  }

  iconName(value: string): string {
    return iconNameFromValue(value);
  }

  private filteredChoices(): EmojiIconChoice[] {
    const cacheKey = [
      this.category,
      this.searchDraft.trim().toLowerCase(),
      this.recommendationText,
      this.recentValues.join('|')
    ].join('::');
    if (cacheKey === this.cachedChoicesKey) {
      return this.cachedChoices;
    }

    const query = this.searchDraft.trim().toLowerCase();
    const source = this.choicesForCategory(query);
    this.cachedChoices = source.filter(option => {
      const matchesQuery =
        !query || `${option.label} ${option.keywords} ${option.value}`.toLowerCase().includes(query);
      return matchesQuery;
    });
    this.cachedChoicesKey = cacheKey;
    return this.cachedChoices;
  }

  private choicesForCategory(query: string): EmojiIconChoice[] {
    if (this.category === 'suggested') {
      return this.suggestedChoices(query);
    }
    if (this.category === 'recent') {
      return this.recentValues.map(value => findEmojiChoiceByValue(value)).filter(Boolean) as EmojiIconChoice[];
    }
    if (this.category === 'all') {
      return allEmojiChoices();
    }
    return CURATED_EMOJI_CHOICES.filter(option => option.category === this.category);
  }

  private suggestedChoices(query: string): EmojiIconChoice[] {
    const text = `${this.recommendationText || ''} ${query || ''}`.toLowerCase();
    const scores = new Map<string, number>();
    for (const option of uniqueChoices([...CURATED_EMOJI_CHOICES, ...APP_ICON_CHOICES])) {
      const haystack = `${option.label} ${option.keywords} ${option.category}`.toLowerCase();
      let score = 0;
      for (const token of tokenizeRecommendationText(text)) {
        if (haystack.includes(token)) {
          score += token.length > 3 ? 4 : 2;
        }
      }
      score += recommendationBoost(option, text);
      if (score > 0) {
        scores.set(option.value, score);
      }
    }

    const choices = uniqueChoices([...CURATED_EMOJI_CHOICES, ...APP_ICON_CHOICES])
      .filter(option => scores.has(option.value))
      .sort((a, b) => (scores.get(b.value) ?? 0) - (scores.get(a.value) ?? 0));

    if (choices.length) {
      return uniqueChoices([...choices, ...this.recentValues.map(value => findEmojiChoiceByValue(value)).filter(Boolean) as EmojiIconChoice[]]);
    }

    return uniqueChoices([
      ...this.recentValues.map(value => findEmojiChoiceByValue(value)).filter(Boolean) as EmojiIconChoice[],
      ...CURATED_EMOJI_CHOICES
    ]);
  }

  private autoSelectSuggestedIcon(): void {
    if (!this.autoSelectRecommendation || this.userSelectedValue) {
      return;
    }
    const current = String(this.value || '');
    if (current && current !== DEFAULT_EMOJI_VALUE && current !== this.lastAutoSelectedValue) {
      return;
    }
    const next = this.suggestedChoices('').find(option => option.value !== current);
    if (!next) {
      return;
    }
    this.value = next.value;
    this.lastAutoSelectedValue = next.value;
    this.valueChange.emit(next.value);
  }

  private remember(value: string): void {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return;
    }
    this.recentValues = [normalized, ...this.recentValues.filter(item => item !== normalized)].slice(0, MAX_RECENT_EMOJI);
    this.invalidateChoices();
    writeRecentEmojiValues(this.recentValues);
  }

  private invalidateChoices(): void {
    this.cachedChoicesKey = '';
    this.cachedChoices = [];
  }
}

export function emojiIconSymbol(value: string | null | undefined): string {
  return emojiIconToken(value) || '';
}

export function emojiIconToken(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  return text.startsWith('emoji:') ? text.slice('emoji:'.length) : text;
}

function iconNameFromValue(value: string | null | undefined): string {
  const text = String(value || '').trim();
  return text.startsWith('icon:') ? text.slice('icon:'.length) : '';
}

function buildGeneratedEmojiChoices(priorityChoices: readonly EmojiIconChoice[]): EmojiIconChoice[] {
  const used = new Set(priorityChoices.map(choice => choice.value));
  const ranges: Array<[number, number, string]> = [
    [0x1f000, 0x1f02f, 'symbols'],
    [0x1f0a0, 0x1f0ff, 'symbols'],
    [0x1f100, 0x1f1ff, 'symbols'],
    [0x1f200, 0x1f2ff, 'symbols'],
    [0x1f300, 0x1f5ff, 'objects'],
    [0x1f600, 0x1f64f, 'people'],
    [0x1f680, 0x1f6ff, 'systems'],
    [0x1f700, 0x1f77f, 'symbols'],
    [0x1f780, 0x1f7ff, 'symbols'],
    [0x1f800, 0x1f8ff, 'symbols'],
    [0x1f900, 0x1f9ff, 'people'],
    [0x1fa00, 0x1fa6f, 'objects'],
    [0x1fa70, 0x1faff, 'objects'],
    [0x1fb00, 0x1fbff, 'symbols'],
    [0x2100, 0x214f, 'symbols'],
    [0x2190, 0x21ff, 'symbols'],
    [0x2300, 0x23ff, 'symbols'],
    [0x2460, 0x24ff, 'symbols'],
    [0x25a0, 0x25ff, 'symbols'],
    [0x2600, 0x27bf, 'symbols'],
    [0x2900, 0x297f, 'symbols'],
    [0x2b00, 0x2bff, 'symbols'],
    [0x3030, 0x303f, 'symbols'],
    [0x3297, 0x3299, 'symbols']
  ];
  const generated: EmojiIconChoice[] = [];

  for (const [start, end, category] of ranges) {
    for (let codePoint = start; codePoint <= end; codePoint += 1) {
      const symbol = String.fromCodePoint(codePoint);
      const value = `emoji:${symbol}`;
      if (used.has(value)) {
        continue;
      }
      used.add(value);
      const hex = codePoint.toString(16).toUpperCase();
      generated.push({
        value,
        label: `Emoji U+${hex}`,
        keywords: `emoji unicode u+${hex} symbol icon`,
        category: categoryFromCodePoint(codePoint, category)
      });
    }
  }

  return generated;
}

function generatedEmojiChoices(): EmojiIconChoice[] {
  generatedEmojiChoicesCache ??= buildGeneratedEmojiChoices(CURATED_EMOJI_CHOICES);
  return generatedEmojiChoicesCache;
}

function flagEmojiChoices(): EmojiIconChoice[] {
  flagEmojiChoicesCache ??= buildFlagEmojiChoices();
  return flagEmojiChoicesCache;
}

function allEmojiChoices(): EmojiIconChoice[] {
  allEmojiChoicesCache ??= [
    ...CURATED_EMOJI_CHOICES,
    ...APP_ICON_CHOICES,
    ...generatedEmojiChoices(),
    ...flagEmojiChoices()
  ];
  return allEmojiChoicesCache;
}

function emojiByValue(): Map<string, EmojiIconChoice> {
  emojiByValueCache ??= new Map(allEmojiChoices().map(choice => [choice.value, choice]));
  return emojiByValueCache;
}

function findEmojiChoiceByValue(value: string | null | undefined): EmojiIconChoice | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return undefined;
  }
  return (
    CURATED_EMOJI_CHOICES.find(choice => choice.value === normalized) ||
    APP_ICON_CHOICES.find(choice => choice.value === normalized) ||
    emojiByValue().get(normalized)
  );
}

function categoryFromCodePoint(codePoint: number, fallback: string): string {
  if (codePoint >= 0x1f600 && codePoint <= 0x1f64f) return 'smileys';
  if (codePoint >= 0x1f466 && codePoint <= 0x1f487) return 'people';
  if (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) return 'people';
  if (codePoint >= 0x1f400 && codePoint <= 0x1f43f) return 'nature';
  if (codePoint >= 0x1f330 && codePoint <= 0x1f343) return 'nature';
  if (codePoint >= 0x1f300 && codePoint <= 0x1f32f) return 'nature';
  if (codePoint >= 0x1f344 && codePoint <= 0x1f37f) return 'food';
  if (codePoint >= 0x1f380 && codePoint <= 0x1f3ff) return 'activity';
  if (codePoint >= 0x1f680 && codePoint <= 0x1f6ff) return 'travel';
  if (codePoint >= 0x1f3e0 && codePoint <= 0x1f3f0) return 'travel';
  if (codePoint >= 0x1f4a0 && codePoint <= 0x1f5ff) return 'objects';
  if (codePoint >= 0x2600 && codePoint <= 0x26ff) return 'symbols';
  if (codePoint >= 0x2700 && codePoint <= 0x27bf) return 'symbols';
  return fallback;
}

function tokenizeRecommendationText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9\u0600-\u06ff]+/u)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    )
  );
}

function recommendationBoost(option: EmojiIconChoice, text: string): number {
  const value = option.value;
  const boosts: Array<[RegExp, string[], number]> = [
    [/(pump|chilled|water|plumb|pipe|hvac|air|vent|duct|cool|مضخ|مياه|تبريد|تكييف|هواء)/u, [emojiValue(0x1f4a7), emojiValue(0x2744), emojiValue(0x1f4a8), emojiValue(0x26fd), emojiValue(0x2699)], 10],
    [/(electric|power|light|cable|panel|voltage|كهرب|انار|لوحه|باور)/u, [emojiValue(0x26a1), emojiValue(0x1f4a1), emojiValue(0x1f50c), emojiValue(0x1f50b)], 10],
    [/(fire|alarm|safety|sprinkler|حريق|انذار|سلام)/u, [emojiValue(0x1f525), emojiValue(0x1f6a8), emojiValue(0x1f6e1), emojiValue(0x1f692)], 10],
    [/(civil|build|concrete|door|window|block|site|مدني|مباني|خرسان|باب|شباك)/u, [emojiValue(0x1f3d7), emojiValue(0x1f3e2), emojiValue(0x1f9f1), emojiValue(0x1f6aa)], 10],
    [/(cost|price|money|budget|boq|invoice|quote|سعر|تكلف|ميزاني|مقايس|فاتور)/u, [emojiValue(0x1f4b5), emojiValue(0x1f9fe), emojiValue(0x1f4cb), emojiValue(0x1f4ca)], 10],
    [/(document|drawing|design|sheet|report|مستند|رسم|تصميم|تقرير)/u, [emojiValue(0x1f4d0), emojiValue(0x1f4c4), emojiValue(0x1f4d1), emojiValue(0x1f4dd)], 10],
    [/(network|camera|cctv|system|bms|wifi|شبك|كامير|سيستم)/u, [emojiValue(0x1f4f6), emojiValue(0x1f4f7), emojiValue(0x1f5a5), emojiValue(0x1f6f0)], 10]
  ];

  let score = 0;
  for (const [pattern, values, points] of boosts) {
    if (pattern.test(text) && values.includes(value)) {
      score += points;
    }
  }
  return score;
}

function uniqueChoices(choices: EmojiIconChoice[]): EmojiIconChoice[] {
  const seen = new Set<string>();
  return choices.filter(choice => {
    if (seen.has(choice.value)) {
      return false;
    }
    seen.add(choice.value);
    return true;
  });
}

function buildAppIconChoices(priorityChoices: readonly EmojiIconChoice[]): EmojiIconChoice[] {
  const used = new Set(priorityChoices.map(choice => choice.value));
  return APP_ICON_NAME_OPTIONS
    .map(name => String(name || '').trim())
    .filter(Boolean)
    .filter(name => {
      const value = iconValue(name);
      if (used.has(value)) {
        return false;
      }
      used.add(value);
      return true;
    })
    .map(name => ({
      value: iconValue(name),
      label: titleFromIconName(name),
      keywords: `${name} ${name.replace(/[-_]/g, ' ')}`,
      category: 'all'
    }));
}

function titleFromIconName(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function readRecentEmojiValues(): string[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecentEmojiValues(values: string[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Ignore storage failures in private or restricted contexts.
  }
}

function buildFlagEmojiChoices(): EmojiIconChoice[] {
  const countryCodes = (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU ' +
    'MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB ' +
    'SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY ' +
    'UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
  ).split(/\s+/);

  return countryCodes.map(code => ({
    value: `emoji:${countryCodeToFlag(code)}`,
    label: `Flag ${code}`,
    keywords: `flag country ${code.toLowerCase()}`,
    category: 'flags'
  }));
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65));
}

function emojiValue(codePoint: number): string {
  return `emoji:${String.fromCodePoint(codePoint)}`;
}

function iconValue(name: string): string {
  return `icon:${name}`;
}
