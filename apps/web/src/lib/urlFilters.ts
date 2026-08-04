/**
 * Keep list-filter state in the URL so it survives a reload and can be
 * shared/linked. Used by /works, /inbox, and /calendar, which all read their
 * filters from search params on mount but previously never wrote them back —
 * so refreshing silently reset you to "everything", and any link built from
 * the current page (e.g. works → calendar) dropped the filter.
 */
import { replaceState } from '$app/navigation';

/**
 * Write the given filters onto the current URL, dropping empty ones so the
 * "no filter" case stays a clean URL rather than `?status=&project_id=`.
 *
 * replaceState (not goto) on purpose: this is a URL-only update, so it must
 * not re-run load functions or push a history entry the back button has to
 * chew through — a user changing a dropdown three times shouldn't need three
 * back presses to leave the page.
 */
export function syncFilterParams(filters: Record<string, string | null | undefined>): void {
  // replaceState throws if called before the router has initialised (SSR or
  // pre-hydration). Filter changes are user-driven so that shouldn't happen,
  // but a failed URL sync must never take the actual filtering down with it.
  try {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(filters)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    replaceState(url, {});
  } catch {
    // URL is cosmetic here — the in-memory filter state is the source of truth.
  }
}

/**
 * Build a link to another page that carries the current project filter, so
 * navigating between Works and Calendar doesn't silently widen the view back
 * to every project.
 */
export function withProjectFilter(path: string, projectId: string): string {
  if (!projectId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}project_id=${encodeURIComponent(projectId)}`;
}
