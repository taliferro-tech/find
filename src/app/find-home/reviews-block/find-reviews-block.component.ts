import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FindReviewsSection } from '../../services/find-experience.service';

// "What people say" (design_handoff_find_game_restaurant_retail, shared by the
// restaurant and store pages): Google's rating and review count on the left;
// on the right, the themes 16Ahead found in three or more of the reviews
// (counts are mentions) and up to three quotes, each one sentence, word for
// word. Google gives no per-star counts, so there's no histogram.
@Component( {
  selector: 'app-find-reviews-block',
  standalone: true,
  imports: [ CommonModule ],
  template: `
    <section class="rb" *ngIf="reviews as r" aria-label="What people say">
      <div class="rb-score" *ngIf="r.rating !== null">
        <strong class="rb-rating">{{ r.rating.toFixed(1) }}</strong>
        <span class="rb-stars" [attr.aria-label]="r.rating.toFixed(1) + ' out of 5 stars'">{{ stars(r.rating) }}</span>
        <a class="rb-count" [href]="r.mapsUrl" target="_blank" rel="noopener">{{ r.count.toLocaleString() }} reviews on Google</a>
      </div>
      <div class="rb-body">
        <h3 class="rb-label">What people say</h3>
        <div class="rb-chips" *ngIf="r.themes.length">
          <span class="rb-chip rb-chip--grey">16Ahead grouped {{ r.grouped }} review{{ r.grouped === 1 ? '' : 's' }}</span>
          <span class="rb-chip" *ngFor="let theme of r.themes; trackBy: trackByIndex" [ngClass]="'rb-chip--' + theme.tone">{{ theme.text }} · {{ theme.count }} mentions</span>
        </div>
        <div class="rb-quotes" *ngIf="r.quotes.length">
          <figure class="rb-quote" *ngFor="let quote of r.quotes; let i = index; trackBy: trackByIndex" [class.rb-quote--third]="i === 2">
            <blockquote>“{{ quote.text }}”</blockquote>
            <figcaption><span *ngIf="quote.stars" [attr.aria-label]="quote.stars + ' stars'">{{ stars(quote.stars) }}</span><ng-container *ngIf="quote.date"> · {{ quote.date | date:'MMM d' }}</ng-container><ng-container *ngIf="quote.author"> · {{ quote.author }}</ng-container></figcaption>
          </figure>
        </div>
      </div>
    </section>
  `,
  styles: [ `
    :host { display: block; }
    .rb { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; padding: 26px 28px; border-radius: 28px; background: var(--surface); color: var(--text); }
    .rb-score { display: flex; flex-direction: column; gap: 6px; }
    .rb-rating { font-size: 64px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
    .rb-stars { font-size: 20px; letter-spacing: 2px; color: #e3a008; }
    .rb-count { font-size: 14px; color: var(--muted); text-decoration: none; }
    .rb-count:hover { text-decoration: underline; }
    .rb-label { margin: 0 0 12px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
    .rb-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .rb-chip { display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }
    .rb-chip--grey { background: var(--bg); color: var(--text); }
    .rb-chip--green { background: var(--t-green); color: var(--t-green-fg); }
    .rb-chip--cyan { background: var(--t-cyan); color: var(--t-cyan-fg); }
    .rb-chip--pink { background: var(--t-pink); color: var(--t-pink-fg); }
    .rb-chip--yellow { background: var(--t-yellow); color: var(--t-yellow-fg); }
    .rb-chip--amber { background: var(--t-amber); color: var(--t-amber-fg); }
    .rb-quotes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rb-quote { display: flex; flex-direction: column; justify-content: space-between; gap: 10px; margin: 0; padding: 16px 18px; border-radius: 18px; background: var(--bg); }
    .rb-quote blockquote { margin: 0; font-size: 15px; line-height: 1.45; }
    .rb-quote figcaption { font-size: 12px; color: var(--muted); }
    .rb-quote figcaption span { color: #e3a008; letter-spacing: 1px; }
    @media (max-width: 900px) {
      .rb { grid-template-columns: minmax(0, 1fr); gap: 18px; }
      .rb-score { flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 10px; }
      .rb-rating { font-size: 48px; }
      .rb-quotes { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .rb { padding: 20px; }
      .rb-quote--third { display: none; }
    }
  ` ],
} )
export class FindReviewsBlockComponent {
  @Input() reviews: FindReviewsSection | null = null;

  trackByIndex ( index: number ): number {
    return index;
  }

  stars ( rating: number ): string {
    const full = Math.round( rating );
    return '★'.repeat( Math.max( 0, Math.min( 5, full ) ) ) + '☆'.repeat( Math.max( 0, 5 - full ) );
  }
}
