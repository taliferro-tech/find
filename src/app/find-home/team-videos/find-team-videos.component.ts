import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { FindEntity, FindExperienceService, FindTeamVideos } from '../../services/find-experience.service';

type TeamVideo = FindTeamVideos[ 'videos' ][ number ];

// A team's latest videos under the scores card (design_handoff_find_team_videos,
// v2): one main stage plus two smaller videos, each behind theater curtains in
// the team's colors. Nothing loads from YouTube until a curtain is clicked.
// Clicking the main curtain opens it and plays; clicking a small one swaps it
// into the main stage (which opens and plays) and drops the old main video,
// player removed, into that spot with its curtain closed again.
@Component( {
  selector: 'app-find-team-videos',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-team-videos.component.html',
  styleUrls: [ './find-team-videos.component.css' ],
} )
export class FindTeamVideosComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;

  row?: FindTeamVideos | null;
  /** The video on the main stage, and the ones in the two spots underneath (by index, in spot order). */
  mainIndex = 0;
  smalls: number[] = [];
  /** The main curtain is open (and, if embeddable, its player is in). */
  open = false;
  swapping = false;
  /** Custom properties for the curtains: --c1 primary, --c2 lighter folds, --c3 shadow, --gold trim. */
  colors: Record<string, string> = {};

  private readonly sanitizer = inject( DomSanitizer );
  private embed: { id: string; url: SafeResourceUrl } | null = null;
  private sub?: Subscription;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( !changes[ 'entity' ] || !this.entity ) return;
    this.sub?.unsubscribe();
    this.reset();
    this.row = undefined;
    this.sub = this.findExperienceService.entitySection<FindTeamVideos>( this.entity, 'videos' ).subscribe( {
      next: response => this.setRow( response?.data ?? null ),
      error: () => this.row = null,
    } );
  }

  ngOnDestroy (): void {
    this.sub?.unsubscribe();
    this.reset();
  }

  get main (): TeamVideo | null {
    return this.row?.videos[ this.mainIndex ] || null;
  }

  /** The player for the main video, built from its id alone (YouTube's no-cookie embed). */
  get mainEmbed (): SafeResourceUrl | null {
    const video = this.main;
    if ( !this.open || !video?.embeddable ) return null;
    if ( this.embed?.id !== video.id ) {
      this.embed = { id: video.id, url: this.sanitizer.bypassSecurityTrustResourceUrl( `https://www.youtube-nocookie.com/embed/${ encodeURIComponent( video.id ) }?autoplay=1&playsinline=1&rel=0` ) };
    }
    return this.embed.url;
  }

  watchUrl ( video: TeamVideo ): string {
    return `https://www.youtube.com/watch?v=${ encodeURIComponent( video.id ) }`;
  }

  tagTone ( type: string | null ): string {
    return { 'Highlights': 'green', 'Press conference': 'blue', 'Top plays': 'yellow', 'Recap': 'violet', 'Analysis': 'cyan' }[ type || '' ] || 'plain';
  }

  ago ( iso: string | null ): string {
    if ( !iso ) return '';
    const days = Math.floor( ( Date.now() - Date.parse( iso ) ) / 86400000 );
    if ( days <= 0 ) return 'Today';
    if ( days === 1 ) return '1 day ago';
    if ( days < 7 ) return `${ days } days ago`;
    const weeks = Math.floor( days / 7 );
    return weeks < 5 ? `${ weeks } week${ weeks > 1 ? 's' : '' } ago` : new Date( iso ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
  }

  playLabel ( video: TeamVideo ): string {
    return `Play: ${ video.title }${ video.type ? ` ${ video.type }` : '' }`;
  }

  /** Opens the main curtain and plays. */
  openMain (): void {
    if ( this.open ) return;
    this.open = true;
  }

  /** Brings the video in spot `slot` up to the main stage and plays it. */
  swap ( slot: number ): void {
    const incoming = this.smalls[ slot ];
    if ( incoming === undefined ) return;
    this.clearTimers();
    // The old main video's player goes away; it takes the clicked spot, curtain closed.
    this.open = false;
    this.embed = null;
    this.smalls = this.smalls.map( ( index, i ) => i === slot ? this.mainIndex : index );
    this.mainIndex = incoming;
    this.swapping = true;
    // A beat with the curtain closed, so it visibly opens on the new video.
    this.timers.push( setTimeout( () => this.open = true, 60 ) );
    this.timers.push( setTimeout( () => this.swapping = false, 450 ) );
  }

  trackByIndex ( index: number ): number {
    return index;
  }

  private setRow ( row: FindTeamVideos | null ): void {
    this.row = row?.videos?.length ? row : null;
    if ( !this.row ) return;
    this.mainIndex = 0;
    this.smalls = this.row.videos.slice( 1, 3 ).map( ( _, i ) => i + 1 );
    this.colors = curtainColors( this.row.colors.primary, this.row.colors.accent );
  }

  private reset (): void {
    this.clearTimers();
    this.open = false;
    this.swapping = false;
    this.embed = null;
  }

  private clearTimers (): void {
    this.timers.forEach( timer => clearTimeout( timer ) );
    this.timers = [];
  }
}

/** c2 = primary lightened 20%, c3 = primary darkened 60% (the handoff's rule). */
export function curtainColors ( primary: string, accent: string ): Record<string, string> {
  return {
    '--c1': primary,
    '--c2': mix( primary, '#ffffff', 0.2 ),
    '--c3': mix( primary, '#000000', 0.6 ),
    '--gold': accent,
  };
}

function mix ( hex: string, toward: string, amount: number ): string {
  const parse = ( value: string ) => {
    const clean = value.replace( '#', '' );
    const full = clean.length === 3 ? clean.split( '' ).map( c => c + c ).join( '' ) : clean;
    return [ 0, 2, 4 ].map( i => parseInt( full.slice( i, i + 2 ), 16 ) || 0 );
  };
  const from = parse( hex );
  const to = parse( toward );
  return '#' + from.map( ( channel, i ) => Math.round( channel + ( to[ i ] - channel ) * amount ).toString( 16 ).padStart( 2, '0' ) ).join( '' );
}
