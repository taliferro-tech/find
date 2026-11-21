import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, PLATFORM_ID, SimpleChanges, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { FindEntity, FindEntitySummary, FindExperienceService, FindGameAlerts, FindGameSection, FindGameTeam, FindWatch } from '../../services/find-experience.service';

const LIVE_REFRESH_MS = 30 * 1000;
const LATE_AFTER_MS = 2 * 60 * 1000;
type AlertChoice = 'start' | 'final' | 'both';

interface GameAction { label: string; href?: string; primary?: boolean; external?: boolean; run?: () => void }

// The game page (design_handoff_find_game_restaurant_retail, part A): one game
// in three states. Before: kickoff, TV, venue, line, records, preview. Live: a
// dark scoreboard that refreshes every 30 s (paused while the tab is hidden),
// scoring plays, score by quarter. Final: score, top players, recap. Teams are
// lettered circles in team colours, never logos. A team taps through to its
// team card; a rivalry or series gets a switcher between the season's games.
@Component( {
  selector: 'app-find-game-card',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './find-game-card.component.html',
  styleUrls: [ '../entity-card/find-entity-card.component.css', './find-game-card.component.css' ],
} )
export class FindGameCardComponent implements OnChanges, OnDestroy {
  @Input( { required: true } ) entity!: FindEntity;
  @Input() query = '';
  @Input() moreCount: number | null = null;
  @Output() moreResults = new EventEmitter<void>();
  /** A team's own card: searches for the team. */
  @Output() search = new EventEmitter<string>();
  @Output() watched = new EventEmitter<FindWatch>();

  game?: FindGameSection | null;
  summary?: FindEntitySummary | null;
  /** The game on screen: the one found, or another of the season series. */
  eventId = '';
  expanded = false;
  lastUpdated = 0;
  now = Date.now();
  newPlayTitle = '';

  watch: FindWatch | null = null;
  alerts: FindGameAlerts = { start: false, scores: false, final: false };
  alertBusy = false;
  alertMessage = '';

  private readonly isBrowser = isPlatformBrowser( inject( PLATFORM_ID ) );
  private readonly document = inject( DOCUMENT );
  private readonly zone = inject( NgZone );
  private subs: Subscription[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private summaryPeriod: string | null = null;
  private readonly onVisibility = () => this.zone.run( () => this.syncPolling( true ) );

  constructor ( private readonly findExperienceService: FindExperienceService ) { }

  ngOnChanges ( changes: SimpleChanges ): void {
    if ( changes[ 'entity' ] && this.entity ) this.open( this.entity.id, true );
  }

  ngOnDestroy (): void {
    this.stop();
  }

  /** Load a game: the one found, or another game of the series. */
  open ( eventId: string, fresh = false ): void {
    this.stop();
    this.eventId = eventId;
    this.game = this.summary = undefined;
    this.summaryPeriod = null;
    this.expanded = false;
    this.newPlayTitle = '';
    if ( fresh ) {
      this.watch = null;
      this.alerts = { start: false, scores: false, final: false };
    }
    this.alertMessage = '';
    this.loadGame();
    if ( this.isBrowser ) {
      this.document.addEventListener( 'visibilitychange', this.onVisibility );
      // "Updated 12 seconds ago" keeps counting without a refresh.
      this.zone.runOutsideAngular( () => {
        this.clockTimer = setInterval( () => this.zone.run( () => this.now = Date.now() ), 5000 );
      } );
    }
  }

  private loadGame ( refresh = false ): void {
    this.subs.push( this.findExperienceService.entitySection<FindGameSection>( this.gameEntity, 'game' ).subscribe( {
      next: response => {
        const data = response?.data ?? null;
        if ( !data ) {
          if ( !refresh ) this.game = null;
          return;
        }
        const previous = this.game;
        if ( refresh && previous?.plays?.[ 0 ]?.title !== data.plays?.[ 0 ]?.title ) this.newPlayTitle = data.plays?.[ 0 ]?.title || '';
        this.game = data;
        this.lastUpdated = Date.now();
        this.now = this.lastUpdated;
        this.syncSummary( previous );
        this.syncPolling();
      },
      // A failed refresh keeps the last score; "Waiting for the next update" shows after two minutes.
      error: () => { if ( !refresh ) this.game = null; },
    } ) );
  }

  /** The summary is written once per state, and once per quarter while live. */
  private syncSummary ( previous: FindGameSection | null | undefined ): void {
    const game = this.game;
    if ( !game ) return;
    const period = `${ game.status }:${ game.status === 'live' ? game.live?.period ?? '' : '' }`;
    if ( period === this.summaryPeriod ) return;
    this.summaryPeriod = period;
    if ( !previous ) this.summary = undefined;
    this.subs.push( this.findExperienceService.entitySection<FindEntitySummary>( this.gameEntity, 'summary' ).subscribe( {
      next: response => this.summary = response?.data?.text ? response.data : ( this.summary || null ),
      error: () => this.summary = this.summary || null,
    } ) );
  }

  /** Poll every 30 s while live and visible; stop when hidden; refresh as soon as it's visible again. */
  private syncPolling ( visibilityChanged = false ): void {
    if ( !this.isBrowser ) return;
    const live = this.game?.status === 'live';
    const visible = this.document.visibilityState !== 'hidden';
    if ( live && visible && !this.pollTimer ) {
      if ( visibilityChanged ) this.loadGame( true );
      this.zone.runOutsideAngular( () => {
        this.pollTimer = setInterval( () => this.zone.run( () => this.loadGame( true ) ), LIVE_REFRESH_MS );
      } );
    } else if ( ( !live || !visible ) && this.pollTimer ) {
      clearInterval( this.pollTimer );
      this.pollTimer = null;
    }
  }

  private stop (): void {
    this.subs.forEach( sub => sub.unsubscribe() );
    this.subs = [];
    if ( this.pollTimer ) clearInterval( this.pollTimer );
    if ( this.clockTimer ) clearInterval( this.clockTimer );
    this.pollTimer = this.clockTimer = null;
    if ( this.isBrowser ) this.document.removeEventListener( 'visibilitychange', this.onVisibility );
  }

  private get gameEntity (): FindEntity {
    return { ...this.entity, id: this.eventId || this.entity.id };
  }

  // --- Display ---

  trackByIndex ( index: number ): number {
    return index;
  }

  trackByTitle ( _: number, play: { title: string; scoreAfter: string } ): string {
    return `${ play.title }|${ play.scoreAfter }`;
  }

  get title (): string {
    const game = this.game;
    if ( !game ) return this.entity.name;
    if ( game.status === 'final' && game.score ) {
      const away = { name: game.away.shortName, points: Number( game.score.away ) };
      const home = { name: game.home.shortName, points: Number( game.score.home ) };
      const [ first, second ] = away.points > home.points ? [ away, home ] : [ home, away ];
      return `${ first.name } ${ first.points }, ${ second.name } ${ second.points }`;
    }
    return `${ game.away.shortName } at ${ game.home.shortName }`;
  }

  get venueText (): string {
    const venue = this.game?.venue;
    if ( !venue?.name ) return venue?.city || '';
    // "Memorial Stadium (Lincoln, NE)" already names its city.
    return venue.city && !venue.name.includes( venue.city.split( ',' )[ 0 ] ) ? `${ venue.name }, ${ venue.city.split( ',' )[ 0 ] }` : venue.name;
  }

  get metaItems (): string[] {
    const game = this.game;
    if ( !game ) return [];
    if ( game.status === 'final' ) return [ this.dayOf( game.start ), this.venueText ].filter( Boolean );
    return [ this.venueText, game.tv ].filter( Boolean );
  }

  get stateChip (): { tone: string; text: string } | null {
    const game = this.game;
    if ( !game ) return null;
    if ( game.status === 'live' ) return { tone: 'red', text: `● Live · ${ this.periodName }` };
    if ( game.status === 'final' ) return { tone: 'grey', text: 'Final' };
    if ( game.status === 'postponed' ) return { tone: 'grey', text: game.statusDetail && !/^postponed$/i.test( game.statusDetail ) ? `Postponed · ${ game.statusDetail }` : 'Postponed' };
    return { tone: 'yellow', text: this.kickoffChip };
  }

  /** "3rd quarter", "2nd half", "Top 5th". */
  get periodName (): string {
    const live = this.game?.live;
    if ( !live ) return '';
    if ( this.game?.league === 'mlb' ) return live.detail;
    const word = this.game?.byPeriod?.word || 'quarter';
    const regulation = word === 'half' ? 2 : 4;
    if ( !live.period ) return live.detail;
    if ( live.period > regulation ) return 'Overtime';
    return `${ this.ordinal( live.period ) } ${ word }`;
  }

  /** "3rd · 8:42". */
  get clockLine (): string {
    const live = this.game?.live;
    if ( !live ) return '';
    if ( this.game?.league === 'mlb' || !live.period ) return live.detail;
    return [ live.period > ( this.game?.byPeriod?.word === 'half' ? 2 : 4 ) ? 'OT' : this.ordinal( live.period ), live.clock ].filter( Boolean ).join( ' · ' );
  }

  get possessionTeam (): FindGameTeam | null {
    const game = this.game;
    const side = game?.live?.possession;
    return game && side ? game[ side ] : null;
  }

  get kickoffChip (): string {
    const start = this.game?.start;
    if ( !start ) return '';
    const date = new Date( start );
    const soon = date.getTime() - Date.now() < 6 * 24 * 3600 * 1000;
    return soon
      ? `${ date.toLocaleDateString( [], { weekday: 'short' } ) } ${ this.timeOf( start ) }`
      : date.toLocaleDateString( [], { weekday: 'short', month: 'short', day: 'numeric' } );
  }

  /** The trailing side's score is dimmed. */
  isBehind ( side: 'away' | 'home' ): boolean {
    const score = this.game?.score;
    if ( !score ) return false;
    const mine = Number( score[ side ] );
    const theirs = Number( score[ side === 'away' ? 'home' : 'away' ] );
    return Number.isFinite( mine ) && Number.isFinite( theirs ) && mine < theirs;
  }

  crestStyle ( team: FindGameTeam ): Record<string, string> {
    const color = team.color || '#5a6170';
    return { background: color, color: this.textOn( color ) };
  }

  crestStyleFor ( abbr: string, color: string | null ): Record<string, string> {
    return this.crestStyle( { abbr, color } as FindGameTeam );
  }

  get updatedText (): string {
    if ( !this.lastUpdated ) return '';
    const seconds = Math.max( 0, Math.round( ( this.now - this.lastUpdated ) / 1000 ) );
    if ( this.now - this.lastUpdated > LATE_AFTER_MS ) return 'Waiting for the next update';
    return `Updated ${ seconds < 5 ? 'just now' : `${ seconds } seconds ago` } · refreshes every 30 seconds`;
  }

  get periods (): number[] {
    return Array.from( { length: this.game?.byPeriod?.count || 0 }, ( _, index ) => index );
  }

  periodLabel ( index: number ): string {
    const word = this.game?.byPeriod?.word;
    const regulation = word === 'half' ? 2 : word === 'inning' ? 9 : 4;
    return index < regulation ? String( index + 1 ) : word === 'inning' ? String( index + 1 ) : index === regulation ? 'OT' : `${ index - regulation + 1 }OT`;
  }

  get scoreTableTitle (): string {
    return `Score by ${ this.game?.byPeriod?.word || 'quarter' }`;
  }

  get summaryTitle (): string {
    const kind = this.summary?.kind || ( this.game?.status === 'pre' ? 'preview' : this.game?.status === 'final' ? 'recap' : 'summary' );
    return `16Ahead ${ kind }`;
  }

  get recordRows (): FindGameTeam[] {
    const game = this.game;
    if ( !game ) return [];
    // The better record first, as the records card does.
    return [ game.home, game.away ].filter( team => team.record ).sort( ( a, b ) => this.winPct( b.record ) - this.winPct( a.record ) );
  }

  seriesTabLabel ( item: { number: number; date: string; status: string; result: string } ): string {
    const word = this.game?.series?.label.startsWith( 'Series' ) ? 'Game' : 'Game';
    const status = item.status === 'final' ? `Final, ${ item.result }` : item.status === 'live' ? 'Live' : this.isNextInSeries( item ) ? 'Next' : 'Later';
    return `${ word } ${ item.number } · ${ this.shortDate( item.date ) } · ${ status }`;
  }

  private isNextInSeries ( item: { status: string; date: string } ): boolean {
    const upcoming = ( this.game?.series?.games || [] ).filter( game => game.status === 'pre' );
    return upcoming[ 0 ]?.date === item.date;
  }

  /** "Game 1 recap" for the season series card. */
  get seriesRecap (): { label: string; href: string } | null {
    const finals = ( this.game?.series?.games || [] ).filter( game => game.status === 'final' && !game.current );
    const last = finals[ finals.length - 1 ];
    return last ? { label: `Game ${ last.number } recap`, href: `https://www.espn.com/${ this.game?.league }/recap?gameId=${ last.id }` } : null;
  }

  get sourceLine (): string {
    const status = this.game?.status;
    if ( status === 'live' ) return 'Live score from ESPN · updates about every 30 seconds';
    if ( status === 'final' ) return 'Final score and stats from ESPN';
    if ( this.game?.series ) return 'Schedule and results from ESPN';
    return 'Schedule, line and records from ESPN';
  }

  get actions (): GameAction[] {
    const game = this.game;
    if ( !game ) return [];
    const espn = game.links.gamecast;
    if ( game.status === 'live' ) {
      return [
        game.tv && { label: `Watch on ${ game.tv }`, href: this.tvUrl( game.tv ), primary: true, external: true },
        espn && { label: 'Live stats on ESPN', href: espn, primary: !game.tv, external: true },
      ].filter( Boolean ) as GameAction[];
    }
    if ( game.status === 'final' ) {
      return [
        { label: 'Full box score on ESPN', href: game.links.boxscore || espn, primary: true, external: true },
        game.links.recap && { label: 'Recap', href: game.links.recap, external: true },
        { label: `${ game.home.shortName } team card`, run: () => this.search.emit( game.home.name ) },
        { label: `${ game.away.shortName } team card`, run: () => this.search.emit( game.away.name ) },
      ].filter( Boolean ) as GameAction[];
    }
    return [
      { label: 'Preview on ESPN', href: game.links.preview || espn, primary: true, external: true },
      game.links.tickets && { label: 'Tickets', href: game.links.tickets, external: true },
      game.start && { label: 'Add to calendar', run: () => this.addToCalendar() },
    ].filter( action => action && ( action.href || action.run ) ) as GameAction[];
  }

  openTeam ( team: FindGameTeam ): void {
    this.search.emit( team.name );
  }

  openSeriesGame ( id: string ): void {
    if ( id !== this.eventId ) this.open( id );
  }

  // --- Alerts ("Watch this game") ---

  get alertChoice (): AlertChoice | null {
    if ( this.alerts.start && this.alerts.final ) return 'both';
    if ( this.alerts.start ) return 'start';
    if ( this.alerts.final ) return 'final';
    return null;
  }

  get startWord (): string {
    const league = this.game?.league;
    return league === 'nba' || league === 'mens-college-basketball' ? 'tip-off' : league === 'mlb' ? 'first pitch' : 'kickoff';
  }

  chooseAlert ( choice: AlertChoice ): void {
    const next = choice === this.alertChoice ? { start: false, scores: false, final: false }
      : { start: choice !== 'final', scores: false, final: choice !== 'start' };
    this.saveAlerts( next );
  }

  toggleLiveAlert ( key: 'final' | 'scores' ): void {
    this.saveAlerts( { ...this.alerts, start: false, [ key ]: !this.alerts[ key ] } );
  }

  private saveAlerts ( next: FindGameAlerts ): void {
    const game = this.game;
    if ( !game || this.alertBusy ) return;
    const previous = this.alerts;
    this.alerts = next;
    this.alertMessage = '';
    this.alertBusy = true;
    const done = (): void => { this.alertBusy = false; };
    const failed = ( err: { error?: { message?: string } } ) => {
      this.alertBusy = false;
      this.alerts = previous;
      this.alertMessage = err?.error?.message || 'Find couldn’t set that alert right now.';
    };
    if ( !next.start && !next.scores && !next.final ) {
      const existing = this.watch;
      if ( !existing ) return done();
      this.findExperienceService.removeWatch( existing.id ).subscribe( { next: () => { this.watch = null; done(); }, error: failed } );
      return;
    }
    this.findExperienceService.createWatch( {
      query: this.query || this.title,
      url: game.links.gamecast,
      title: `${ game.away.shortName } at ${ game.home.shortName }`,
      queryType: 'game',
      game: { league: game.league, eventId: game.id, alerts: next },
    } ).subscribe( {
      next: ( { watch } ) => { this.watch = watch; this.watched.emit( watch ); done(); },
      error: failed,
    } );
  }

  // --- Calendar ---

  addToCalendar (): void {
    const game = this.game;
    if ( !game?.start || !this.isBrowser ) return;
    const start = new Date( game.start );
    const end = new Date( start.getTime() + 3.5 * 3600 * 1000 );
    const stamp = ( date: Date ) => date.toISOString().replace( /[-:]/g, '' ).replace( /\.\d{3}/, '' );
    const escape = ( text: string ) => text.replace( /([,;\\])/g, '\\$1' );
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//16Ahead//Find//EN', 'BEGIN:VEVENT',
      `UID:${ game.id }@find.16ahead.com`, `DTSTAMP:${ stamp( new Date() ) }`, `DTSTART:${ stamp( start ) }`, `DTEND:${ stamp( end ) }`,
      `SUMMARY:${ escape( `${ game.away.shortName } at ${ game.home.shortName }` ) }`,
      `LOCATION:${ escape( this.venueText ) }`,
      `DESCRIPTION:${ escape( [ game.tv && `On ${ game.tv }`, game.links.gamecast ].filter( Boolean ).join( ' · ' ) ) }`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join( '\r\n' );
    const link = this.document.createElement( 'a' );
    link.href = `data:text/calendar;charset=utf-8,${ encodeURIComponent( ics ) }`;
    link.download = `${ game.away.abbr }-at-${ game.home.abbr }.ics`;
    link.click();
  }

  // --- Formatting ---

  ordinal ( n: number ): string {
    return [ '', '1st', '2nd', '3rd' ][ n ] || `${ n }th`;
  }

  timeOf ( iso: string | null ): string {
    return iso ? new Date( iso ).toLocaleTimeString( [], { hour: 'numeric', minute: '2-digit' } ) : '';
  }

  dayOf ( iso: string | null ): string {
    return iso ? new Date( iso ).toLocaleDateString( [], { weekday: 'short', month: 'short', day: 'numeric' } ) : '';
  }

  shortDate ( iso: string ): string {
    return new Date( iso ).toLocaleDateString( [], { month: 'short', day: 'numeric' } );
  }

  /** "Oct 2025" for a past matchup; this season's say "Oct 4". */
  pastDate ( iso: string ): string {
    const date = new Date( iso );
    return Date.now() - date.getTime() < 200 * 24 * 3600 * 1000
      ? date.toLocaleDateString( [], { month: 'short', day: 'numeric' } )
      : date.toLocaleDateString( [], { month: 'short', year: 'numeric' } );
  }

  private winPct ( record: string ): number {
    const [ wins, losses, ties ] = record.split( '-' ).map( Number );
    const games = ( wins || 0 ) + ( losses || 0 ) + ( ties || 0 );
    return games ? ( ( wins || 0 ) + ( ties || 0 ) / 2 ) / games : 0;
  }

  private tvUrl ( network: string ): string {
    const known: Record<string, string> = { Fox: 'https://www.foxsports.com/live', CBS: 'https://www.cbs.com/live-tv/', NBC: 'https://www.peacocktv.com/sports', ESPN: 'https://www.espn.com/watch/', ABC: 'https://abc.com/watch-live', 'Prime Video': 'https://www.amazon.com/primevideo', Netflix: 'https://www.netflix.com', NFLN: 'https://www.nfl.com/network/watch/nfl-network-live', TNT: 'https://www.tntdrama.com/watchtnt', 'Big Ten Network': 'https://www.foxsports.com/live/btn', BTN: 'https://www.foxsports.com/live/btn', 'ESPN2': 'https://www.espn.com/watch/' };
    return known[ network ] || this.game?.links.gamecast || '';
  }

  /** White or near-black text, whichever reads on the team colour. */
  private textOn ( hex: string ): string {
    const value = hex.replace( '#', '' );
    if ( value.length !== 6 ) return '#ffffff';
    const [ r, g, b ] = [ 0, 2, 4 ].map( i => parseInt( value.slice( i, i + 2 ), 16 ) / 255 ).map( c => c <= 0.03928 ? c / 12.92 : ( ( c + 0.055 ) / 1.055 ) ** 2.4 );
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.45 ? '#0f1115' : '#ffffff';
  }
}
