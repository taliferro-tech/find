import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FindAward, FindAwardsService } from '../../services/find-awards.service';
import { FindDailyService } from '../../services/find-daily.service';

/**
 * Daily Find: today's question, the same for everyone. Start it, search
 * with Find as usual (the search page counts those searches), then pick
 * one of four answers. Scoring lives on the backend (findDaily.service.js).
 */
@Component( {
  selector: 'app-find-daily',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './find-daily.component.html',
  styleUrl: './find-daily.component.css'
} )
export class FindDailyComponent implements OnInit {
  /** Run this search in Find, counted for today's question. */
  @Output() search = new EventEmitter<string>();
  /** A rank or badge the answer earned, for the unlock overlay. */
  @Output() unlock = new EventEmitter<FindAward>();

  query = '';
  busy = false;
  message = '';
  shareMessage = '';

  constructor ( readonly daily: FindDailyService, private readonly awards: FindAwardsService ) { }

  ngOnInit (): void {
    this.daily.load().subscribe();
  }

  get state () {
    return this.daily.state;
  }

  start (): void {
    this.busy = true;
    this.message = '';
    this.daily.start().subscribe( {
      next: () => { this.busy = false; },
      error: ( err ) => { this.busy = false; this.message = err?.error?.message || 'Couldn’t start today’s Daily Find. Try again.'; },
    } );
  }

  runSearch (): void {
    const query = this.query.trim();
    if ( !query ) return;
    this.search.emit( query );
  }

  answer ( choice: number ): void {
    if ( this.busy ) return;
    this.busy = true;
    this.message = '';
    this.daily.answer( choice ).subscribe( {
      next: ( state ) => {
        this.busy = false;
        const unlocked = this.awards.applyAward( state.score );
        if ( unlocked ) this.unlock.emit( unlocked );
      },
      error: ( err ) => { this.busy = false; this.message = err?.error?.message || 'That answer didn’t go through. Try again.'; },
    } );
  }

  async share (): Promise<void> {
    const result = this.state?.result;
    if ( !result ) return;
    const text = result.correct
      ? `I scored ${ result.points } on today’s Daily Find${ result.beat !== null ? ` and beat ${ result.beat }% of Finders` : '' }. Can you beat it?`
      : 'Today’s Daily Find got me. Can you get it?';
    // The /d/ link's preview shows the score and question (Messages keeps only the link).
    const url = result.shareUrl || 'https://find.16ahead.com/?daily=1';
    try {
      if ( typeof navigator !== 'undefined' && navigator.share ) {
        await navigator.share( { title: 'Daily Find', text, url } );
        return;
      }
      await navigator.clipboard?.writeText( `${ text } ${ url }` );
      this.shareMessage = 'Copied.';
    } catch {
      // The share sheet was closed.
    }
  }
}
