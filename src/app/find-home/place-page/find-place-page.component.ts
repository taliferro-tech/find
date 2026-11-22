import { CommonModule } from '@angular/common';
import { Component, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FindAskResult, FindDishesSection, FindPlaceLocation, FindPlacePhoto, FindPlacePhotos, FindProductsSection, FindRetailSection, FindReviewsSection } from '../../services/find-experience.service';
import { FindBusinessCardComponent } from '../business-card/find-business-card.component';
import { FindReviewsBlockComponent } from '../reviews-block/find-reviews-block.component';
import { FindTeamVideosComponent } from '../team-videos/find-team-videos.component';

interface PlaceAction { label: string; href: string; primary?: boolean; external: boolean; icon: string }

// The restaurant page and the retail store page
// (design_handoff_find_game_restaurant_retail, parts B and C). Built on the
// business card, which already knows the place, its hours and whether it's
// open; this adds the photo strip, popular dishes or quick facts, "Ask this
// store" and "Shop online", "What people say", the week's hours and (for a
// restaurant) videos people made about it. Every section hides when there's
// nothing real to show. Local services keep the business card.
@Component( {
  selector: 'app-find-place-page',
  standalone: true,
  imports: [ CommonModule, FormsModule, FindReviewsBlockComponent, FindTeamVideosComponent ],
  templateUrl: './find-place-page.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-place-page.component.css' ],
} )
export class FindPlacePageComponent extends FindBusinessCardComponent implements OnChanges {
  reviews?: FindReviewsSection | null;
  dishes?: FindDishesSection | null;
  retail?: FindRetailSection | null;
  products?: FindProductsSection | null;

  /** The photo viewer: all of Google's photos (up to 10), loaded when opened. */
  viewer: FindPlacePhoto[] | null = null;
  viewerIndex = 0;
  viewerLoading = false;
  failedPhotos = new Set<string>();

  askQuery = '';
  asking = false;
  askResult: FindAskResult | null = null;
  askError = '';

  override ngOnChanges ( changes: SimpleChanges ): void {
    super.ngOnChanges( changes );
    if ( !( changes[ 'entity' ] || changes[ 'position' ] ) || !this.entity ) return;
    this.reviews = this.dishes = this.retail = this.products = undefined;
    this.viewer = null;
    this.failedPhotos = new Set();
    this.askQuery = '';
    this.askResult = null;
    this.askError = '';
    this.fetch<FindReviewsSection>( 'reviews', data => this.reviews = data && ( data.rating !== null || data.quotes.length ) ? data : null );
    if ( this.isRestaurant ) {
      this.fetch<FindDishesSection>( 'dishes', data => this.dishes = ( data?.dishes?.length || 0 ) >= 2 ? data : null );
      this.retail = this.products = null;
    } else {
      this.fetch<FindRetailSection>( 'retail', data => this.retail = data );
      this.fetch<FindProductsSection>( 'products', data => this.products = data?.products?.length ? data : null );
      this.dishes = null;
    }
  }

  // Dishes come from the dishes section and products from the products section.
  protected override wants ( section: string ): boolean {
    return section !== 'details' && section !== 'sale';
  }

  get isRestaurant (): boolean {
    return this.entity.type === 'restaurant';
  }

  // --- Title block ---

  get initials (): string {
    const words = this.name.replace( /[^A-Za-z0-9\s]/g, '' ).split( /\s+/ ).filter( Boolean );
    if ( this.isRestaurant || words.length < 2 ) return ( words[ 0 ]?.[ 0 ] || '?' ).toUpperCase();
    return ( words[ 0 ][ 0 ] + words[ 1 ][ 0 ] ).toUpperCase();
  }

  /** Green open, amber closing soon, red closed. */
  get openChip (): { tone: string; text: string } | null {
    const status = this.status;
    if ( !status ) return null;
    const tone = status.tone === 'green' ? 'green' : status.tone === 'yellow' ? 'amber' : 'red';
    const location = this.nearest;
    if ( status.tone === 'green' && location?.nextCloseTime ) return { tone, text: `Open · closes ${ this.timeAt( location.nextCloseTime, location ) }` };
    if ( status.tone === 'muted' && location?.nextOpenTime ) return { tone, text: `Closed · opens ${ this.timeAt( location.nextOpenTime, location ) }` };
    return { tone, text: status.short };
  }

  get categoryChip (): string {
    return this.place?.category || this.entity.label;
  }

  get pageMeta (): string[] {
    const place = this.place;
    if ( !place ) return [];
    const rating = place.rating ? [ `★ ${ place.rating.value.toFixed( 1 ) }`, `${ place.rating.count.toLocaleString() } reviews` ] : [];
    if ( this.isRestaurant ) return [ ...rating, [ this.street( place.nearest ), place.nearest.city ].filter( Boolean ).join( ', ' ), place.nearest.phone ].filter( Boolean );
    return [ ...rating, place.priceLevel, this.cityState( place.nearest ) ].filter( Boolean );
  }

  // --- Photos ---

  get photos (): FindPlacePhoto[] {
    return ( this.place?.photos || [] ).filter( photo => !this.failedPhotos.has( photo.url ) );
  }

  get hero (): FindPlacePhoto | null {
    return this.photos[ 0 ] || null;
  }

  get strip (): FindPlacePhoto[] {
    return this.photos.slice( 1, 5 );
  }

  photoFailed ( photo: FindPlacePhoto ): void {
    this.failedPhotos = new Set( [ ...this.failedPhotos, photo.url ] );
  }

  openViewer ( index = 0 ): void {
    this.viewerIndex = index;
    this.viewer = this.photos;
    if ( ( this.place?.photoCount || 0 ) <= this.photos.length ) return;
    this.viewerLoading = true;
    this.fetch<FindPlacePhotos>( 'photos', data => {
      this.viewerLoading = false;
      if ( data?.photos?.length && this.viewer ) this.viewer = data.photos;
    } );
  }

  closeViewer (): void {
    this.viewer = null;
  }

  stepViewer ( by: number ): void {
    const count = this.viewer?.length || 0;
    if ( count ) this.viewerIndex = ( this.viewerIndex + by + count ) % count;
  }

  @HostListener( 'document:keydown', [ '$event' ] )
  onKey ( event: KeyboardEvent ): void {
    if ( !this.viewer ) return;
    if ( event.key === 'Escape' ) this.closeViewer();
    if ( event.key === 'ArrowRight' ) this.stepViewer( 1 );
    if ( event.key === 'ArrowLeft' ) this.stepViewer( -1 );
  }

  // --- Visit card ---

  get visitLabel (): string {
    const open = this.status;
    const where = this.isRestaurant ? ( this.place?.usedPosition ? 'Nearest location' : 'Location' ) : 'Visit';
    return [ where, open?.short ].filter( Boolean ).join( ' · ' );
  }

  get visitHeadline (): string {
    const location = this.nearest;
    if ( !location ) return '';
    return this.isRestaurant ? this.street( location ) : this.cityState( location );
  }

  /** "Seattle · 0.1 mi away · open until 2 PM, then 4–8 PM". */
  get visitLine (): string {
    const location = this.nearest;
    if ( !location ) return '';
    const parts: string[] = [];
    if ( this.isRestaurant ) parts.push( location.city );
    if ( this.isRestaurant && location.distanceMi !== null ) parts.push( `${ this.miles( location ) } away` );
    const until = this.untilText;
    if ( until ) parts.push( until );
    if ( !this.isRestaurant && this.retail?.shipsNationwide ) parts.push( 'also ships across the US' );
    return parts.join( ' · ' );
  }

  private get untilText (): string {
    const location = this.nearest;
    if ( !location?.openNow || !location.nextCloseTime ) return '';
    const close = this.timeAt( location.nextCloseTime, location );
    const shifts = this.shifts( this.rawTodayHours );
    const later = shifts.findIndex( shift => shift.endsWith( close.replace( ' ', '' ) ) || shift.split( '–' )[ 1 ]?.trim() === close );
    const next = later >= 0 ? shifts[ later + 1 ] : '';
    return `${ this.isRestaurant ? 'open' : 'Open' } until ${ close }${ next ? `, then ${ next }` : '' }`;
  }

  private get rawTodayHours (): string {
    const location = this.nearest;
    const week = this.place?.hoursWeek || [];
    if ( !location || week.length !== 7 ) return '';
    return week.find( ( _, index ) => this.isToday( index ) )?.hours || '';
  }

  get visitTiles (): Array<{ label: string; value: string }> {
    const location = this.nearest;
    if ( !location ) return [];
    const today = this.compactHours( this.rawTodayHours ).split( ' · ' )[ 0 ];
    const price = [ this.place?.priceLevel, this.place?.priceRange ].filter( Boolean ).join( ' · ' );
    return [
      today && { label: 'Today', value: today },
      location.distanceMi !== null && { label: 'Distance', value: this.miles( location ) },
      this.isRestaurant ? price && { label: 'Price', value: price } : this.retail?.returns && { label: 'Returns', value: this.retail.returns },
    ].filter( ( tile ): tile is { label: string; value: string } => !!tile );
  }

  // --- Hours ---

  /** "10:00 AM – 2:00 PM, 4:00 – 8:00 PM" -> "10 AM–2 PM · 4–8 PM". */
  compactHours ( hours: string ): string {
    return this.shifts( hours ).join( ' · ' ) || hours;
  }

  private shifts ( hours: string ): string[] {
    return String( hours || '' ).split( /,\s*/ ).map( shift => shift.replace( /:00(?=\s?[AP]M)/g, '' ).replace( /:00(?=\s?[–-])/g, '' ).replace( /\s*[–-]\s*/g, '–' ).trim() ).filter( Boolean );
  }

  // --- Quick facts and the store ---

  get quickFacts (): Array<{ label: string; value: string }> {
    const retail = this.retail;
    if ( !retail ) return [];
    return [
      retail.knownFor && { label: 'Known for', value: retail.knownFor },
      retail.madeIn && { label: 'Made in', value: retail.madeIn },
      retail.prices && { label: 'Prices', value: retail.prices },
    ].filter( ( fact ): fact is { label: string; value: string } => !!fact );
  }

  get onStore (): boolean {
    return !!this.retail?.shop;
  }

  ask (): void {
    const shop = this.retail?.shop;
    const query = this.askQuery.trim();
    if ( !shop || !query || this.asking ) return;
    this.asking = true;
    this.askError = '';
    this.askResult = null;
    this.findExperienceService.askStore( shop.slug, query ).subscribe( {
      next: ( { result } ) => {
        this.asking = false;
        this.askResult = result;
        if ( !result ) this.askError = 'The store couldn’t search right now.';
      },
      error: () => { this.asking = false; this.askError = 'The store couldn’t search right now.'; },
    } );
  }

  stockChip ( stock: string ): { tone: string; text: string } | null {
    return stock === 'in' ? { tone: 'green', text: 'In stock' } : stock === 'low' ? { tone: 'amber', text: 'Low stock' } : stock === 'new' ? { tone: 'violet', text: 'New' } : null;
  }

  // --- Actions and sources ---

  get pageActions (): PlaceAction[] {
    const place = this.place;
    const location = this.nearest;
    const website = place?.website || this.entity.website || '';
    const directions = location && { label: 'Directions', href: location.directionsUrl, external: true, icon: 'fa-location-arrow' };
    const call = location?.phone && { label: 'Call', href: `tel:${ location.phone.replace( /[^0-9+]/g, '' ) }`, external: false, icon: 'fa-phone' };
    if ( this.isRestaurant ) {
      const menu = this.dishes?.menuUrl || website;
      return [
        menu && { label: 'Menu & ordering', href: menu, primary: true, external: true, icon: 'fa-utensils' },
        directions,
        call,
        location?.mapsUrl && { label: 'Google Maps', href: location.mapsUrl, external: true, icon: 'fa-map-location-dot' },
      ].filter( Boolean ) as PlaceAction[];
    }
    const shop = this.retail?.shop?.url || website;
    return [
      shop && { label: 'Shop online', href: shop, primary: true, external: true, icon: 'fa-bag-shopping' },
      directions,
      call,
      this.retail?.instagram && { label: 'Instagram', href: this.retail.instagram, external: true, icon: 'fa-instagram' },
    ].filter( Boolean ) as PlaceAction[];
  }

  // --- Helpers ---

  /** "Los Angeles, CA" from "123 Main St, Los Angeles, CA 90012, USA". */
  cityState ( location: FindPlaceLocation ): string {
    const parts = location.address.split( ',' ).map( part => part.trim() );
    const state = ( parts[ parts.length - 2 ] || '' ).split( ' ' )[ 0 ];
    return [ location.city, state ].filter( Boolean ).join( ', ' ) || location.shortAddress;
  }

  private timeAt ( iso: string, location: FindPlaceLocation ): string {
    const ms = Date.parse( iso );
    if ( !Number.isFinite( ms ) ) return '';
    const offset = location.utcOffsetMinutes ?? -new Date( ms ).getTimezoneOffset();
    return new Date( ms + offset * 60000 ).toLocaleTimeString( 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } ).replace( ':00', '' );
  }
}
