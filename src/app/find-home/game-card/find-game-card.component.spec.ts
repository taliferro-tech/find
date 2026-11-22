import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FindEntity, FindExperienceService, FindGameSection } from '../../services/find-experience.service';
import { FindGameCardComponent } from './find-game-card.component';

const team = ( id: string, abbr: string, name: string, shortName: string, color: string ) => ( { id, abbr, name, shortName, record: '7-2', color, rank: null, standing: '3rd in NFC North' } );

function game ( overrides: Partial<FindGameSection> = {} ): FindGameSection {
  return {
    id: '401873071', league: 'nfl', leagueName: 'NFL', round: 'Week 12', status: 'pre', statusDetail: '', start: '2026-11-22T18:00:00Z', tv: 'Fox',
    venue: { name: 'Soldier Field', city: 'Chicago, IL' }, line: { spread: 'CHI -11.5', overUnder: '44.5' },
    away: team( '18', 'NO', 'New Orleans Saints', 'Saints', '#d3bc8d' ), home: team( '3', 'CHI', 'Chicago Bears', 'Bears', '#0b1c3a' ),
    score: null, byPeriod: null, live: null, plays: [], leaders: [],
    links: { gamecast: 'https://www.espn.com/nfl/game/_/gameId/401873071', recap: '', boxscore: '', preview: 'https://www.espn.com/nfl/preview/_/gameId/401873071', tickets: '' },
    series: null, past: [], updatedAt: '2026-11-21T12:00:00Z',
    ...overrides,
  };
}

describe( 'FindGameCardComponent', () => {
  let fixture: ComponentFixture<FindGameCardComponent>;
  let service: jasmine.SpyObj<FindExperienceService>;
  let current: FindGameSection;
  const entity: FindEntity = { type: 'game', league: 'nfl', label: 'NFL game', id: '401873071', name: 'Saints at Bears', logoUrl: null };

  beforeEach( async () => {
    service = jasmine.createSpyObj<FindExperienceService>( 'FindExperienceService', [ 'entitySection', 'createWatch', 'removeWatch' ] );
    service.entitySection.and.callFake( ( ( asked: FindEntity, section: string ) => of( { data: section === 'game' ? { ...current, id: asked.id } : { text: 'The Bears host the Saints.', sources: [ 'ESPN' ], kind: 'preview' } } ) ) as never );
    await TestBed.configureTestingModule( { imports: [ FindGameCardComponent ], providers: [ { provide: FindExperienceService, useValue: service } ] } ).compileComponents();
  } );

  function render ( data: FindGameSection ): HTMLElement {
    current = data;
    fixture = TestBed.createComponent( FindGameCardComponent );
    fixture.componentRef.setInput( 'entity', entity );
    fixture.componentRef.setInput( 'query', 'saints bears game' );
    fixture.componentInstance.ngOnChanges( { entity: { currentValue: entity } as never } );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach( () => fixture?.destroy() );

  it( 'before the game: away at home, kickoff, line, records and the preview', () => {
    const el = render( game() );
    expect( el.querySelector( 'h1' )?.textContent?.trim() ).toBe( 'Saints at Bears' );
    expect( el.textContent ).toContain( 'Watch this game' );
    expect( el.textContent ).toContain( 'CHI -11.5 · O/U 44.5' );
    expect( el.textContent ).toContain( '3rd in NFC North' );
    expect( el.textContent ).toContain( '16Ahead preview' );
    expect( el.querySelector( '.gc-board--live' ) ).toBeNull();
  } );

  it( 'live: a dark scoreboard, the clock, the LIVE marker and scoring plays', () => {
    const el = render( game( {
      status: 'live', score: { away: '10', home: '21' },
      byPeriod: { word: 'quarter', count: 4, away: [ '7', '3', '0', null ], home: [ '7', '7', '7', null ] },
      live: { period: 3, clock: '8:42', detail: '8:42 - 3rd', possession: 'home', downDistance: '2nd & 6 at NO 34', outs: null },
      plays: [ { teamAbbr: 'CHI', teamColor: '#0b1c3a', title: 'Touchdown · D’Andre Swift 12-yd run', detail: '3rd · 10:15', scoreAfter: '10–21' } ],
    } ) );
    expect( el.querySelector( '.gc-board--live' ) ).not.toBeNull();
    expect( el.textContent ).toContain( '● Live · 3rd quarter' );
    expect( el.textContent ).toContain( '3rd · 8:42' );
    expect( el.textContent ).toContain( 'Bears ball' );
    expect( el.textContent ).toContain( 'Touchdown · D’Andre Swift 12-yd run' );
    expect( el.querySelector( '.gc-live-pill' )?.textContent ).toContain( 'LIVE' );
    // Quarters not played yet show a dash.
    expect( Array.from( el.querySelectorAll( '.gc-table tbody tr:first-child td' ) ).map( cell => cell.textContent?.trim() ) ).toEqual( [ '7', '3', '0', '–', '10' ] );
  } );

  it( 'final: the winner first in the title, top players and past matchups', () => {
    const el = render( game( {
      status: 'final', score: { away: '17', home: '31' },
      byPeriod: { word: 'quarter', count: 4, away: [ '7', '3', '0', '7' ], home: [ '7', '7', '7', '10' ] },
      leaders: [ { name: 'Caleb Williams', teamAbbr: 'CHI', pos: 'QB', category: 'Passing', line: '264 yds · 2 TD' } ],
      past: [ { id: '1', date: '2025-10-19T17:00:00Z', venue: 'Chicago', result: 'Bears 26, Saints 14', recapUrl: 'https://www.espn.com/nfl/recap?gameId=1' } ],
      links: { gamecast: 'https://www.espn.com/g', recap: 'https://www.espn.com/r', boxscore: 'https://www.espn.com/b', preview: '', tickets: '' },
    } ) );
    expect( el.querySelector( 'h1' )?.textContent?.trim() ).toBe( 'Bears 31, Saints 17' );
    expect( el.textContent ).toContain( 'Caleb Williams' );
    expect( el.textContent ).toContain( 'Bears 26, Saints 14' );
    expect( el.textContent ).toContain( 'Full box score on ESPN' );
  } );

  it( 'a team taps through to its team card', () => {
    const el = render( game() );
    const searched: string[] = [];
    fixture.componentInstance.search.subscribe( ( query: string ) => searched.push( query ) );
    ( el.querySelector( '.gc-team--home' ) as HTMLButtonElement ).click();
    expect( searched ).toEqual( [ 'Chicago Bears' ] );
  } );

  it( 'Alert at kickoff starts a game watch for this game', () => {
    service.createWatch.and.returnValue( of( { success: true, watch: { id: 'w1' } as never } ) );
    const el = render( game() );
    ( el.querySelector( '.gc-option' ) as HTMLButtonElement ).click();
    expect( service.createWatch ).toHaveBeenCalledWith( jasmine.objectContaining( { queryType: 'game', game: { league: 'nfl', eventId: '401873071', alerts: { start: true, scores: false, final: false } } } ) );
  } );

  it( 'a rivalry switches between the season’s games', () => {
    const el = render( game( { series: { label: 'Rivalry · 2nd meeting', record: 'Packers lead 1–0', games: [
      { id: '111', number: 1, date: '2026-10-04T17:00:00Z', status: 'final', result: 'GB 24–21', current: false },
      { id: '401873071', number: 2, date: '2026-12-13T18:00:00Z', status: 'pre', result: '', current: true },
    ] } } ) );
    expect( el.textContent ).toContain( 'Packers lead 1–0' );
    ( el.querySelector( '.gc-switcher__tab' ) as HTMLButtonElement ).click();
    expect( service.entitySection.calls.mostRecent().args[ 0 ].id ).toBe( '111' );
  } );
} );
