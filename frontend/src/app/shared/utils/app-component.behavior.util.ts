import type { ElementRef } from '@angular/core';
import type { MenuItem } from '../data/app-navigation.data';
import { getAppScale, getSidebarOpenWidth } from './app-shell.util';

export interface AppSearchHost {
  searchableMenuItems(): MenuItem[];
}

export interface AppSearchHighlightSegment {
  text: string;
  matched: boolean;
}

export function normalizeAppSearchValue(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAppSearchHaystacks(item: MenuItem): string[] {
  const pathText = item.path.replace(/[/-]+/g, ' ');
  return [item.label, pathText, ...(item.searchTerms ?? [])]
    .map(value => normalizeAppSearchValue(value))
    .filter(Boolean);
}

export function buildAppSearchHighlightSegments(
  value: string,
  query: string
): AppSearchHighlightSegment[] {
  const text = String(value ?? '');
  const tokens = normalizeAppSearchValue(query).split(' ').filter(Boolean);

  if (!text) {
    return [];
  }

  if (!tokens.length) {
    return [{ text, matched: false }];
  }

  const pattern = tokens
    .map(token => escapeAppSearchRegExp(token))
    .sort((left, right) => right.length - left.length)
    .join('|');

  if (!pattern) {
    return [{ text, matched: false }];
  }

  const regex = new RegExp(`(${pattern})`, 'gi');
  const segments: AppSearchHighlightSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(regex)) {
    const index = match.index ?? -1;
    if (index < 0) {
      continue;
    }

    if (index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, index),
        matched: false
      });
    }

    segments.push({
      text: text.slice(index, index + match[0].length),
      matched: true
    });
    lastIndex = index + match[0].length;
  }

  if (!segments.length) {
    return [{ text, matched: false }];
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      matched: false
    });
  }

  return segments;
}

export function formatAppSearchPath(path: string): string {
  return String(path ?? '')
    .split('/')
    .filter(Boolean)
    .join(' / ');
}

export function scoreAppSearchItem(item: MenuItem, normalizedQuery: string): number {
  const haystacks = buildAppSearchHaystacks(item);
  const label = normalizeAppSearchValue(item.label);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  let score = 0;

  if (label === normalizedQuery) {
    score = Math.max(score, 1200);
  }
  if (haystacks.some(value => value === normalizedQuery)) {
    score = Math.max(score, 1000);
  }
  if (label.startsWith(normalizedQuery)) {
    score = Math.max(score, 900);
  }
  if (haystacks.some(value => value.startsWith(normalizedQuery))) {
    score = Math.max(score, 700);
  }
  if (haystacks.some(value => value.includes(normalizedQuery))) {
    score = Math.max(score, 500);
  }

  if (tokens.length > 1) {
    const tokenHits = tokens.filter(token =>
      haystacks.some(value => value.includes(normalizeAppSearchValue(token)))
    ).length;
    score += tokenHits * 40;
  }

  if (item.disabled) {
    score -= 15;
  }

  return score;
}

export function itemMatchesAppSearch(item: MenuItem, normalizedQuery: string): boolean {
  return scoreAppSearchItem(item, normalizedQuery) > 0;
}

export function findBestAppSearchMatch(host: AppSearchHost, query: string): MenuItem | null {
  const normalizedQuery = normalizeAppSearchValue(query);
  if (!normalizedQuery) {
    return null;
  }

  let bestMatch: MenuItem | null = null;
  let bestScore = -1;

  for (const item of host.searchableMenuItems()) {
    const score = scoreAppSearchItem(item, normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

function escapeAppSearchRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAppSidebarTooltipCoords(
  isBrowser: boolean,
  target: HTMLElement
): { left: number; top: number } {
  const scale = getAppScale(isBrowser, target);
  const anchor = target;
  const rect = anchor.getBoundingClientRect();
  const gap = 10;
  const left = rect.right / scale + gap;
  const top = (rect.top + rect.height / 2) / scale;
  return { left, top };
}

export interface AppAccountMenuHost {
  isBrowser: boolean;
  accountPillRef?: ElementRef<HTMLDivElement>;
  accountMenuRef?: ElementRef<HTMLDivElement>;
  sideCollapsed: boolean;
  accountMenuLeft: number;
  accountMenuTop: number;
  accountMenuWidth: number;
}

export function updateAppAccountMenuPosition(host: AppAccountMenuHost): void {
  if (!host.isBrowser) {
    return;
  }
  const pill = host.accountPillRef?.nativeElement;
  if (!pill) {
    return;
  }
  const scale = getAppScale(host.isBrowser, pill);
  const rect = pill.getBoundingClientRect();
  const rectLeft = rect.left / scale;
  const rectRight = rect.right / scale;
  const rectTop = rect.top / scale;
  const rectBottom = rect.bottom / scale;
  const rectWidth = rect.width / scale;

  const viewport = window.visualViewport;
  const viewportWidth = (viewport?.width ?? window.innerWidth) / scale;
  const viewportHeight = (viewport?.height ?? window.innerHeight) / scale;
  const viewportLeft = (viewport?.offsetLeft ?? 0) / scale;
  const viewportTop = (viewport?.offsetTop ?? 0) / scale;

  const maxWidth = Math.max(0, viewportWidth - 16);
  const openWidth = getSidebarOpenWidth(host.isBrowser);
  const isCollapsed = host.sideCollapsed || (openWidth > 0 && rectWidth <= openWidth * 0.75);
  const targetWidth = isCollapsed && openWidth > 0 ? Math.max(openWidth - 8, rectWidth) : rectWidth;
  let width = Math.min(targetWidth, maxWidth);
  let left: number;
  if (isCollapsed) {
    const gap = 10;
    const preferredLeft = rectRight + gap;
    const availableRight = Math.max(0, viewportLeft + viewportWidth - preferredLeft - 8);
    if (availableRight > 0) {
      width = Math.min(width, availableRight);
      left = Math.max(viewportLeft + 8, preferredLeft);
    } else {
      const maxLeft = viewportLeft + viewportWidth - width - 8;
      const fallbackLeft = rectLeft - width - gap;
      left = Math.max(viewportLeft + 8, Math.min(fallbackLeft, maxLeft));
    }
  } else {
    const maxLeft = viewportLeft + viewportWidth - width - 8;
    left = Math.max(viewportLeft + 8, Math.min(rectLeft, maxLeft));
  }

  host.accountMenuLeft = left;
  host.accountMenuWidth = width;

  setTimeout(() => {
    const menu = host.accountMenuRef?.nativeElement;
    if (!menu) {
      return;
    }
    const gap = 10;
    const menuHeight = menu.getBoundingClientRect().height / scale;
    let top = rectTop - menuHeight - gap;
    if (top < viewportTop + 8) {
      top = rectBottom + gap;
    }
    const maxTop = Math.max(viewportTop + 8, viewportTop + viewportHeight - menuHeight - 8);
    host.accountMenuTop = Math.min(Math.max(top, viewportTop + 8), maxTop);
  }, 0);
}
