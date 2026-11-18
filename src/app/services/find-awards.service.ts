import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { FindExperienceService, FindRank, FindScoreAward, FindScoreBadge, FindScoreProfile } from './find-experience.service';

export type FindAwardIcon =
  | 'rebel' | 'curious' | 'night-owl' | 'early-bird' | 'connector' | 'sharp-eye'
  | 'explorer' | 'specialist' | 'relentless' | 'tastemaker' | 'legend'
  | 'streak' | 'collector' | 'all-cards' | 'rank' | 'daily';

export type FindAwardState = 'unlocked' | 'locked' | 'mystery';

export interface FindAward {
  id: string;
  title: string;
  threshold: number;
  copy: string;
  icon: FindAwardIcon;
  hidden?: boolean;
  group?: FindScoreBadge['group'];
  goal?: string;
  /** Shown above the title in the unlock overlay ("Award Unlocked", "New Rank"). */
  eyebrow?: string;
}

export interface FindAwardView extends FindAward {
  state: FindAwardState;
}

export interface FindAwardsProgress {
  count: number;
  unlockedCount: number;
  totalCount: number;
  percent: number;
  nextAward: ( FindAward & { searchesToGo: number } ) | null;
}

export interface FindAwardGroup {
  id: FindScoreBadge['group'];
  title: string;
  awards: FindAwardView[];
}

interface UnlockedRecord {
  title: string;
  copy: string;
  icon: FindAwardIcon;
  unlockedAt: string;
}

const KNOWN_ICONS: FindAwardIcon[] = [ 'rebel', 'curious', 'night-owl', 'early-bird', 'connector', 'sharp-eye', 'explorer', 'specialist', 'relentless', 'tastemaker', 'legend', 'streak', 'collector', 'all-cards', 'rank', 'daily' ];
const GROUP_TITLES: Record<FindScoreBadge['group'], string> = { searches: 'Searches', streaks: 'Streaks', cards: 'Cards', daily: 'Daily Find' };

// The on-device ladder from before Find Score. It's still counted until the
// backend has taken it over (imported), and shown when the backend can't be
// reached, so nobody sees their awards vanish.
// The Night Owl / Early Bird slot resolves to whichever title fits the
// moment it's earned, then keeps that resolution forever.
const AWARD_LADDER: FindAward[] = [
  { id: 'rebel', title: 'The Rebel', threshold: 1, icon: 'rebel',
    copy: 'You don’t wait for permission — you go find it yourself.' },
  { id: 'curious-one', title: 'The Curious One', threshold: 3, icon: 'curious',
    copy: 'You can’t leave a question alone. Never could.' },
  { id: 'night-owl', title: 'The Night Owl / Early Bird', threshold: 6, icon: 'night-owl',
    copy: '3am and your mind’s still going. That’s not insomnia — that’s you.' },
  { id: 'connector', title: 'The Connector', threshold: 10, icon: 'connector',
    copy: 'You saw the thread before anyone said it out loud.' },
  { id: 'sharp-eye', title: 'The Sharp Eye', threshold: 15, icon: 'sharp-eye',
    copy: 'Something felt off and you were right.' },
  { id: 'explorer', title: 'The Explorer', threshold: 20, icon: 'explorer',
    copy: 'One result was never going to be enough for you.' },
  { id: 'specialist', title: 'The Specialist', threshold: 30, icon: 'specialist',
    copy: 'You stopped skimming. You went all the way down.' },
  { id: 'relentless', title: 'The Relentless', threshold: 40, icon: 'relentless',
    copy: 'Something in you refused to close the tab.' },
  { id: 'tastemaker', title: 'The Tastemaker', threshold: 60, icon: 'tastemaker',
    copy: 'People catch up to what you already knew.' },
  { id: 'legend', title: 'The Legend', threshold: 100, icon: 'legend', hidden: true,
    copy: 'You stopped counting a while ago. So did we.' },
];

@Injectable( { providedIn: 'root' } )
export class FindAwardsService {
  private readonly COUNT_KEY = 'find-awards-count';
  private readonly UNLOCKED_KEY = 'find-awards-unlocked';
  private readonly PROFILE_KEY = 'find-score-profile';

  private count = 0;
  private unlocked = new Map<string, UnlockedRecord>();
  private cachedProfile: FindScoreProfile | null = null;
  private importChecked = false;
  /** What the latest search, rating or card earned (for "+12" under a result). */
  lastAward: FindScoreAward | null = null;

  constructor ( private readonly findExperience: FindExperienceService ) {
    this.load();
  }

  get searchCount (): number {
    return this.cachedProfile?.searchCount ?? this.count;
  }

  /** The Find Score profile as last seen (cached), or null before the first one. */
  get profile (): FindScoreProfile | null {
    return this.cachedProfile;
  }

  get rank (): FindRank | null {
    return this.cachedProfile?.rank ?? null;
  }

  /** How far into the current rank, 0-100. */
  get rankPercent (): number {
    const rank = this.cachedProfile?.rank;
    if ( !rank?.next ) return 100;
    const span = rank.next.min - rank.min;
    return span > 0 ? Math.round( ( ( this.cachedProfile!.score - rank.min ) / span ) * 100 ) : 100;
  }

  get awards (): FindAwardView[] {
    if ( this.cachedProfile?.badges?.length ) {
      return this.cachedProfile.badges.map( badge => this.toView( badge ) );
    }
    return AWARD_LADDER.map( ( award ) => {
      const record = this.unlocked.get( award.id );
      if ( record ) {
        return { ...award, title: record.title, copy: record.copy, icon: record.icon, state: 'unlocked' as const };
      }
      return { ...award, state: ( award.hidden ? 'mystery' : 'locked' ) as FindAwardState };
    } );
  }

  get groups (): FindAwardGroup[] {
    const groups: FindAwardGroup[] = [];
    for ( const award of this.awards ) {
      const id = award.group || 'searches';
      let group = groups.find( item => item.id === id );
      if ( !group ) {
        group = { id, title: GROUP_TITLES[id], awards: [] };
        groups.push( group );
      }
      group.awards.push( award );
    }
    return groups;
  }

  get progress (): FindAwardsProgress {
    const awards = this.awards;
    const trackable = awards.filter( ( award ) => !award.hidden );
    const unlockedCount = trackable.filter( ( award ) => award.state === 'unlocked' ).length;
    const nextLadderAward = this.cachedProfile ? null : AWARD_LADDER.filter( award => !award.hidden ).find( ( award ) => !this.unlocked.has( award.id ) ) || null;
    return {
      count: this.searchCount,
      unlockedCount,
      totalCount: awards.length,
      percent: trackable.length ? Math.round( ( unlockedCount / trackable.length ) * 100 ) : 0,
      nextAward: nextLadderAward
        ? { ...nextLadderAward, searchesToGo: Math.max( 0, nextLadderAward.threshold - this.count ) }
        : null
    };
  }

  /**
   * The old on-device count, for a search the backend didn't score (it
   * couldn't be reached, or isn't scoring yet). Returns the award just
   * unlocked, or null.
   */
  recordSearch (): FindAward | null {
    if ( this.cachedProfile?.imported ) return null;
    this.count += 1;
    this.save();

    let justUnlocked: FindAward | null = null;
    for ( const award of AWARD_LADDER ) {
      if ( this.unlocked.has( award.id ) || this.count < award.threshold ) continue;
      const resolved = this.resolveAward( award );
      this.unlocked.set( award.id, { title: resolved.title, copy: resolved.copy, icon: resolved.icon, unlockedAt: new Date().toISOString() } );
      justUnlocked = resolved;
    }
    if ( justUnlocked ) this.save();
    return justUnlocked;
  }

  /**
   * Takes what a search, rating or card earned and returns what to show: a
   * new rank first, then a new badge, else null. The first one each visit
   * also loads the whole profile (and hands over the old on-device count).
   */
  applyAward ( award: FindScoreAward | null | undefined ): FindAward | null {
    if ( !award ) return null;
    this.lastAward = award;
    const profile = this.cachedProfile;
    if ( profile ) {
      const earned = new Map( award.newBadges.map( badge => [ badge.id, badge ] ) );
      this.setProfile( {
        ...profile,
        score: award.total,
        weekScore: award.weekScore,
        rank: award.rank,
        streak: { ...profile.streak, count: award.streak, best: Math.max( profile.streak.best, award.streak ) },
        badges: profile.badges.map( badge => earned.has( badge.id ) ? { ...badge, ...earned.get( badge.id ), state: 'earned' } : badge ),
      } );
    }
    if ( !this.importChecked ) this.refresh().subscribe();
    if ( award.rankUp ) {
      return { id: `rank-${ award.rankUp }`, title: award.rankUp, threshold: 0, icon: 'rank', eyebrow: 'New Rank',
        copy: award.rank.next ? `${ award.total.toLocaleString( 'en-US' ) } points. ${ award.rank.next.toGo.toLocaleString( 'en-US' ) } more to ${ award.rank.next.name }.` : `${ award.total.toLocaleString( 'en-US' ) } points. The top rank.` };
    }
    const badge = award.newBadges[0];
    return badge ? this.toView( badge ) : null;
  }

  /** Loads the profile from the backend; the first time, hands over the old count. */
  refresh (): Observable<FindScoreProfile | null> {
    return this.findExperience.scoreProfile().pipe(
      switchMap( ( { profile } ) => {
        this.importChecked = true;
        if ( profile.imported || this.count === 0 ) return of( profile );
        const badges = [ ...this.unlocked.entries() ].map( ( [ id, record ] ) => ( { id, title: record.title, icon: record.icon } ) );
        return this.findExperience.importAwards( this.count, badges ).pipe(
          map( response => response.profile ),
          catchError( () => of( profile ) ),
        );
      } ),
      tap( profile => this.setProfile( profile ) ),
      catchError( () => of( this.cachedProfile ) ),
    );
  }

  setNickname ( nickname: string ): Observable<FindScoreProfile> {
    return this.findExperience.setNickname( nickname ).pipe(
      map( response => response.profile ),
      tap( profile => this.setProfile( profile ) ),
    );
  }

  recoveryCode (): Observable<string> {
    return this.findExperience.recoveryCode().pipe( map( response => response.code ) );
  }

  recover ( code: string ): Observable<FindScoreProfile> {
    return this.findExperience.recoverScore( code ).pipe(
      map( response => response.profile ),
      tap( profile => this.setProfile( profile ) ),
    );
  }

  private toView ( badge: FindScoreBadge ): FindAwardView {
    const icon = ( KNOWN_ICONS as string[] ).includes( badge.icon ) ? badge.icon as FindAwardIcon : 'collector';
    const state: FindAwardState = badge.state === 'earned' || !badge.state ? 'unlocked' : badge.state === 'mystery' ? 'mystery' : 'locked';
    return { id: badge.id, title: badge.title, copy: badge.copy, icon, threshold: 0, hidden: badge.hidden, group: badge.group, goal: badge.goal, state };
  }

  private setProfile ( profile: FindScoreProfile | null ): void {
    if ( !profile ) return;
    this.cachedProfile = profile;
    try {
      localStorage.setItem( this.PROFILE_KEY, JSON.stringify( profile ) );
    } catch { /* ignore */ }
  }

  private resolveAward ( award: FindAward ): FindAward {
    if ( award.id !== 'night-owl' ) return award;
    const hour = new Date().getHours();
    const isEarly = hour >= 4 && hour < 12;
    return isEarly
      ? { ...award, title: 'The Early Bird', icon: 'early-bird', copy: 'You were thinking before the world woke up.' }
      : { ...award, title: 'The Night Owl', icon: 'night-owl', copy: '3am and your mind’s still going. That’s not insomnia — that’s you.' };
  }

  private load (): void {
    try {
      this.count = Number( localStorage.getItem( this.COUNT_KEY ) ) || 0;
    } catch {
      this.count = 0;
    }
    try {
      const raw = localStorage.getItem( this.UNLOCKED_KEY );
      const parsed: Record<string, UnlockedRecord> = raw ? JSON.parse( raw ) : {};
      this.unlocked = new Map( Object.entries( parsed ) );
    } catch {
      this.unlocked = new Map();
    }
    try {
      const raw = localStorage.getItem( this.PROFILE_KEY );
      this.cachedProfile = raw ? JSON.parse( raw ) : null;
    } catch {
      this.cachedProfile = null;
    }
  }

  private save (): void {
    try {
      localStorage.setItem( this.COUNT_KEY, String( this.count ) );
      localStorage.setItem( this.UNLOCKED_KEY, JSON.stringify( Object.fromEntries( this.unlocked ) ) );
    } catch { /* ignore */ }
  }
}
