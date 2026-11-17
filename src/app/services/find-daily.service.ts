import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { FindDailyState, FindExperienceService } from './find-experience.service';

/**
 * Daily Find on the web (backend findDaily.service.js): today's question,
 * whether this browser is playing it, and its result. While playing, the
 * search page tags its searches with `playingDate` so the backend counts them.
 */
@Injectable( { providedIn: 'root' } )
export class FindDailyService {
  state: FindDailyState | null = null;
  loading = false;
  error = '';

  constructor ( private readonly findExperience: FindExperienceService ) { }

  /** The date to send with a search, while today's question is being played. */
  get playingDate (): string | null {
    return this.state?.status === 'playing' ? this.state.date : null;
  }

  load (): Observable<FindDailyState | null> {
    this.loading = true;
    return this.findExperience.dailyFind().pipe(
      map( response => response.daily ),
      tap( daily => { this.state = daily; this.loading = false; this.error = ''; } ),
      catchError( () => {
        this.loading = false;
        return of( this.state );
      } ),
    );
  }

  start (): Observable<FindDailyState> {
    return this.findExperience.startDailyFind( this.state!.date ).pipe(
      map( response => response.daily ),
      tap( daily => this.state = daily ),
    );
  }

  answer ( choice: number ): Observable<FindDailyState> {
    return this.findExperience.answerDailyFind( this.state!.date, choice ).pipe(
      map( response => response.daily ),
      tap( daily => this.state = daily ),
    );
  }

  /** A search counted for today's question: the choices unlock after the first. */
  noteSearch ( daily: { date: string; searches: number } | undefined ): void {
    if ( !daily || !this.state || daily.date !== this.state.date ) return;
    const firstSearch = !this.state.searches && daily.searches > 0;
    this.state = { ...this.state, searches: daily.searches };
    if ( firstSearch ) this.load().subscribe();
  }
}
