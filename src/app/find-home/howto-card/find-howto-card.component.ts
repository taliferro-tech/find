import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FindEntity, FindExperienceService, FindHowToAnswer, FindHowToVideoSection } from '../../services/find-experience.service';

// How-to answers with one video (design_handoff_find_howto_video, 2026-11-17):
// the answer first (summary, steps, facts, ingredients or what you need), then
// one YouTube video that loads only when tapped. Chapter chips and the steps'
// timestamp pills jump the video there and play it. No good video: no video,
// just a note and a YouTube search link.
@Component( {
  selector: 'app-find-howto-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-howto-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-howto-card.component.css' ],
} )
export class FindHowToCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();

  @ViewChild( 'player' ) player?: ElementRef<HTMLIFrameElement>;

  answer?: FindHowToAnswer | null;
  video?: FindHowToVideoSection | null;
  playing = false;
  activeSec: number | null = null;
  /** Phone: which steps are open to show their detail. */
  openSteps = new Set<number>();

  private readonly sanitizer = inject( DomSanitizer );
  private embedUrl: SafeResourceUrl | null = null;
  private subs: Subscription[] = [];

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes[ 'entity' ] || !this.entity ) return;
    this.subs.forEach( sub => sub.unsubscribe() );
    this.answer = undefined;
    this.video = undefined;
    this.stop();
    this.openSteps.clear();
    // Two requests: the answer never waits on the video.
    this.subs = [
      this.findExperienceService.entitySection<FindHowToAnswer>( this.entity, 'answer' ).subscribe( {
        next: response => this.answer = response?.data ?? null,
        error: () => this.answer = null,
      } ),
      this.findExperienceService.entitySection<FindHowToVideoSection>( this.entity, 'video' ).subscribe( {
        next: response => this.video = response?.data ?? null,
        error: () => this.video = null,
      } ),
    ];
  }

  ngOnDestroy (): void {
    this.subs.forEach( sub => sub.unsubscribe() );
    // Leaving the page removes the player, which stops it.
    this.stop();
  }

  /** The video lookup finished with nothing good enough (state c). */
  get noVideo (): boolean {
    return this.video !== undefined && !this.video?.video;
  }

  get recipe (): boolean {
    return this.answer?.category === 'recipe';
  }

  get categoryLabel (): string {
    return { recipe: 'Recipe', diy: 'DIY', tech: 'Tech', other: '' }[ this.answer?.category || 'other' ];
  }

  get things (): string[] {
    return this.answer?.ingredients?.length ? this.answer.ingredients : this.answer?.tools || [];
  }

  get thingsTitle (): string {
    return this.answer?.ingredients?.length ? 'Ingredients' : 'What you need';
  }

  get sourceLine (): string {
    const names = ( this.answer?.summary.sources || [] ).map( source => source.name );
    if ( this.video?.video ) names.push( 'video' );
    return names.join( ', ' );
  }

  /** "More key lime pie videos on YouTube". */
  get moreLabel (): string {
    const topic = ( this.answer?.title || this.entity?.name || '' ).toLowerCase();
    return topic ? `More ${ topic } videos on YouTube` : 'More videos on YouTube';
  }

  get moreUrl (): string {
    return this.video?.moreUrl || this.answer?.moreUrl || '';
  }

  get embed (): SafeResourceUrl | null {
    return this.playing ? this.embedUrl : null;
  }

  stepChapter ( index: number ): number | null {
    const sec = this.video?.stepChapters?.[ index ];
    return this.video?.video && typeof sec === 'number' ? sec : null;
  }

  /** "Chill & serve" -> chip text; "1:02:10" style times. */
  clock ( sec: number ): string {
    const h = Math.floor( sec / 3600 );
    const m = Math.floor( sec % 3600 / 60 );
    const s = String( sec % 60 ).padStart( 2, '0' );
    return h ? `${ h }:${ String( m ).padStart( 2, '0' ) }:${ s }` : `${ m }:${ s }`;
  }

  views ( count: number ): string {
    if ( count >= 1e6 ) return `${ ( count / 1e6 ).toFixed( count >= 1e7 ? 0 : 1 ).replace( /\.0$/, '' ) }M views`;
    if ( count >= 1e3 ) return `${ Math.round( count / 1e3 ) }K views`;
    return `${ count } views`;
  }

  /** Plays from the start, or jumps to a chapter and plays. */
  playAt ( sec = 0 ): void {
    const video = this.video?.video;
    if ( !video ) return;
    this.activeSec = sec || null;
    if ( this.playing && this.player?.nativeElement.contentWindow ) {
      this.command( 'seekTo', [ sec, true ] );
      this.command( 'playVideo' );
      return;
    }
    // Built from the id alone, so only YouTube's own (no-cookie) embed can load.
    const origin = typeof location !== 'undefined' ? `&origin=${ encodeURIComponent( location.origin ) }` : '';
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${ encodeURIComponent( video.id ) }?autoplay=1&playsinline=1&rel=0&enablejsapi=1&start=${ Math.max( 0, Math.floor( sec ) ) }${ origin }` );
    this.playing = true;
  }

  toggleStep ( index: number ): void {
    if ( this.openSteps.has( index ) ) this.openSteps.delete( index );
    else this.openSteps.add( index );
  }

  trackByIndex ( index: number ): number {
    return index;
  }

  // The IFrame Player API's postMessage commands, without loading its script.
  private command ( func: string, args: unknown[] = [] ): void {
    this.player?.nativeElement.contentWindow?.postMessage( JSON.stringify( { event: 'command', func, args } ), 'https://www.youtube-nocookie.com' );
  }

  private stop (): void {
    this.playing = false;
    this.embedUrl = null;
    this.activeSec = null;
  }
}
