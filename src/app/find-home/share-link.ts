import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Shareable address bar (2026-11-23): once a result has rendered, Find
 * swaps the address bar from /?query=… to the result's short link
 * (/s/<id>), so a link copied from the address bar previews as the result's
 * card instead of Find's generic one. The swap is history.replaceState, not
 * a navigation, so Back still works.
 *
 * A full load of /s/<id> goes to the server (Hosting rewrites it to the API,
 * which forwards to ?query=). Back or Forward onto a swapped entry stays in
 * the app, so this route turns the id back into its search from what this
 * tab remembered, and asks the server otherwise.
 */
const KEY = 'find.shareLinks';
const MAX = 50;

function read (): Record<string, string> {
  try {
    const value = JSON.parse( sessionStorage.getItem( KEY ) || '{}' );
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** Remembers which search a short link stands for (this tab only). */
export function rememberShareLink ( id: string, query: string ): void {
  if ( !/^[0-9A-Za-z]{10}$/.test( id ) || !query ) return;
  try {
    const links = read();
    delete links[id];
    links[id] = query;
    const ids = Object.keys( links );
    for ( const old of ids.slice( 0, Math.max( 0, ids.length - MAX ) ) ) delete links[old];
    sessionStorage.setItem( KEY, JSON.stringify( links ) );
  } catch { /* private mode: the server still handles the link */ }
}

export function rememberedShareLink ( id: string ): string {
  return String( read()[id] || '' );
}

/** /s/:id inside the app: back to its search, or let the server answer. */
export const shareLinkGuard: CanActivateFn = ( route ) => {
  const id = String( route.paramMap.get( 'id' ) || '' );
  const query = typeof window === 'undefined' ? '' : rememberedShareLink( id );
  if ( query ) return inject( Router ).createUrlTree( [ '/' ], { queryParams: { query } } );
  if ( typeof window !== 'undefined' && /^[0-9A-Za-z]{10}$/.test( id ) ) {
    window.location.replace( `/s/${ id }${ window.location.search }` );
    return false;
  }
  return inject( Router ).createUrlTree( [ '/' ] );
};
