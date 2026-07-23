import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { TenderRow } from './tender-project-details/project-details.component';
import type { IdName } from './tender-projects.contracts';
import { resolveTenderProjectLookupDisplayLabel } from './tender-projects.lookup.util';

type LookupResolver = {
  parseId: (value: unknown) => number | null;
  resolveNameById: (list: IdName[], id?: number | string | null) => string | null;
  findLookupByName: (list: IdName[], name?: string | null) => IdName | null;
  upsertLookup: (list: IdName[], item: IdName) => IdName[];
  extractApiErrorMessage: (err: unknown) => string;
};

type PrepareRowDependencies = LookupResolver & {
  row: TenderRow;
  countries: IdName[];
  owners: IdName[];
  stages: IdName[];
  top: IdName[];
  createCountry: (name: string) => Observable<IdName>;
  createOwner: (name: string, countryId: number | null) => Observable<IdName>;
  createTenderStage: (name: string) => Observable<IdName>;
  createTypeOfProject: (name: string) => Observable<IdName>;
  onCountriesChange: (next: IdName[]) => void;
  onOwnersChange: (next: IdName[]) => void;
  onStagesChange: (next: IdName[]) => void;
  onTopChange: (next: IdName[]) => void;
};

function normalizeLookupCandidateName(
  value: string | null | undefined,
  label?: string
): string | null {
  const text = (value ?? '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const lowerLabel = (label ?? '').trim().toLowerCase();
  if (lower === '-' || lower === '—') return null;
  if (lower === 'select' || lower.startsWith('select ')) return null;
  if (lower === 'choose' || lower.startsWith('choose ')) return null;
  if (lowerLabel && (lower === lowerLabel || lower === `select ${lowerLabel}`)) return null;
  if (lower === 'name' || lower === 'select name') return null;
  return text;
}

function ensureLookupItemForSave(
  resolver: LookupResolver,
  options: {
    list: IdName[];
    name: string | null | undefined;
    existingId: number | null | undefined;
    createFn: (name: string) => Observable<IdName>;
    apply: (item: IdName) => void;
    label: string;
  }
): Observable<IdName | null> {
  const trimmed = normalizeLookupCandidateName(options.name, options.label);
  const parsedId = resolver.parseId(options.existingId);
  if (parsedId) {
    const resolvedName = resolver.resolveNameById(options.list, parsedId);
    if (!trimmed) {
      return of({ id: parsedId, name: resolvedName ?? '' });
    }
    if (resolvedName?.trim().toLowerCase() === trimmed.toLowerCase()) {
      return of({ id: parsedId, name: resolvedName });
    }
  }

  if (!trimmed) return of(null);

  const found = resolver.findLookupByName(options.list, trimmed);
  if (found) return of(found);

  return options.createFn(trimmed).pipe(
    map(created => {
      options.apply(created);
      return created;
    }),
    catchError(err => {
      const message = resolver.extractApiErrorMessage(err);
      return throwError(() => new Error(`Failed to create ${options.label}: ${message}`));
    })
  );
}

export function prepareTenderProjectRowForSave(
  deps: PrepareRowDependencies
): Observable<TenderRow> {
  const country$ = ensureLookupItemForSave(deps, {
    list: deps.countries,
    name: deps.row.country,
    existingId: deps.row.countryId,
    createFn: deps.createCountry,
    apply: created => {
      deps.onCountriesChange(deps.upsertLookup(deps.countries, created));
    },
    label: 'country'
  }).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  const owner$ = country$.pipe(
    switchMap(country => {
      const existingOwner = deps.findLookupByName(deps.owners, deps.row.owner);
      const ownerName = normalizeLookupCandidateName(deps.row.owner, 'owner');
      const currentOwnerId = deps.parseId(deps.row.ownerId);
      const resolvedOwnerName = currentOwnerId
        ? deps.resolveNameById(deps.owners, currentOwnerId)
        : null;
      const ownerId =
        currentOwnerId &&
        ownerName &&
        resolvedOwnerName?.trim().toLowerCase() !== ownerName.toLowerCase()
          ? null
          : (currentOwnerId ?? existingOwner?.id ?? null);
      if (ownerId) {
        const label =
          resolveTenderProjectLookupDisplayLabel(existingOwner) ??
          resolvedOwnerName ??
          ownerName ??
          `Owner ${ownerId}`;
        return of({ id: ownerId, name: label });
      }

      if (!ownerName) return of(null);

      const countryId =
        country?.id ??
        deps.parseId(deps.row.countryId) ??
        deps.findLookupByName(deps.countries, deps.row.country)?.id ??
        null;

      return ensureLookupItemForSave(deps, {
        list: deps.owners,
        name: ownerName,
        existingId: null,
        createFn: name => deps.createOwner(name, countryId),
        apply: created => {
          deps.onOwnersChange(deps.upsertLookup(deps.owners, created));
        },
        label: 'owner'
      });
    })
  );

  const stage$ = ensureLookupItemForSave(deps, {
    list: deps.stages,
    name: deps.row.ts,
    existingId: deps.row.tenderStageId,
    createFn: deps.createTenderStage,
    apply: created => {
      deps.onStagesChange(deps.upsertLookup(deps.stages, created));
    },
    label: 'stage'
  });

  const type$ = ensureLookupItemForSave(deps, {
    list: deps.top,
    name: deps.row.top,
    existingId: deps.row.typeOfProjectId,
    createFn: deps.createTypeOfProject,
    apply: created => {
      deps.onTopChange(deps.upsertLookup(deps.top, created));
    },
    label: 'type'
  });

  return forkJoin({ owner: owner$, country: country$, stage: stage$, type: type$ }).pipe(
    map(({ owner, country, stage, type }) => ({
      ...deps.row,
      ownerId: owner?.id ?? deps.row.ownerId,
      owner: resolveTenderProjectLookupDisplayLabel(owner) ?? deps.row.owner,
      countryId: country?.id ?? deps.row.countryId,
      country: resolveTenderProjectLookupDisplayLabel(country) ?? deps.row.country,
      tenderStageId: stage?.id ?? deps.row.tenderStageId,
      ts: resolveTenderProjectLookupDisplayLabel(stage) ?? deps.row.ts,
      typeOfProjectId: type?.id ?? deps.row.typeOfProjectId,
      top: resolveTenderProjectLookupDisplayLabel(type) ?? deps.row.top
    }))
  );
}
