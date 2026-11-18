import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FindHowToCardComponent } from './howto-card/find-howto-card.component';
import { FindTeamVideosComponent, curtainColors } from './team-videos/find-team-videos.component';
import { FindEntity, FindHowToAnswer, FindHowToVideoSection, FindTeamVideos } from '../services/find-experience.service';

// How-to answers with one video and the team curtain row (2026-11-17).
describe('Find video cards', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ provideHttpClient(), provideHttpClientTesting() ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const section = (name: string) => http.expectOne(r => r.url.endsWith('/find/entity/section') && r.body.section === name);

  const answer: FindHowToAnswer = {
    title: 'Key lime pie', category: 'recipe',
    facts: [ { label: 'prep', value: '20 min' }, { label: 'servings', value: '8' } ],
    meta: 'How to make it · 3 steps · about 3½ hours with chilling',
    summary: { text: 'A graham cracker crust with a lime filling.', sources: [ { name: 'Allrecipes', url: 'https://www.allrecipes.com/x' } ] },
    steps: [ { title: 'Make the crust', detail: 'Mix crumbs and butter.' }, { title: 'Mix the filling', detail: 'Whisk yolks and juice.' }, { title: 'Serve', detail: 'Top with cream.' } ],
    ingredients: [ '4 egg yolks', '½ cup key lime juice' ],
    moreUrl: 'https://www.youtube.com/results?search_query=key+lime+pie',
  };
  const video: FindHowToVideoSection = {
    video: { provider: 'youtube', id: 'abcdefghijk', title: 'Easy Key Lime Pie', channel: 'Sample Kitchen', views: 1200000, durationSec: 588, duration: '9:48', thumbUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', chapters: [ { title: 'Crust', sec: 42 }, { title: 'Filling', sec: 178 }, { title: 'Bake', sec: 370 } ] },
    stepChapters: [ 42, 178, null ],
    moreUrl: 'https://www.youtube.com/results?search_query=how+to+make+a+key+lime+pie',
  };

  function howTo () {
    const fixture = TestBed.createComponent(FindHowToCardComponent);
    fixture.componentInstance.entity = { type: 'howto', label: 'How-to', id: 'make a key lime pie', name: 'Key lime pie', logoUrl: null } as FindEntity;
    fixture.componentInstance.query = 'how to make a key lime pie';
    fixture.componentInstance.ngOnChanges({ entity: {} as any });
    fixture.detectChanges();
    return fixture;
  }

  it('shows the answer before the video, then the video only after a tap; chapters and step pills jump there', () => {
    const fixture = howTo();
    const el: HTMLElement = fixture.nativeElement;
    section('answer').flush({ data: answer });
    fixture.detectChanges();
    expect(el.textContent).toContain('Key lime pie');
    expect(el.textContent).toContain('20 min prep');
    expect(el.textContent).toContain('Make the crust');
    expect(el.textContent).toContain('Ingredients');
    // The video is still loading: a placeholder, no "Video" pill yet.
    expect(el.querySelector('.hc-video--skel')).not.toBeNull();
    expect(el.textContent).not.toContain('We didn\'t find a video');

    section('video').flush({ data: video });
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.textContent).toContain('Easy Key Lime Pie');
    // Steps with a matching chapter get a timestamp pill; the last one doesn't.
    expect(Array.from(el.querySelectorAll('.hc-stamp')).map(b => b.textContent!.trim())).toEqual([ '0:42', '2:58' ]);

    (el.querySelector('.hc-chapter:nth-child(2)') as HTMLButtonElement).click();
    fixture.detectChanges();
    const iframe = el.querySelector('iframe')!;
    expect(iframe.src).toContain('https://www.youtube-nocookie.com/embed/abcdefghijk?');
    expect(iframe.src).toContain('start=178');
    expect(iframe.src).toContain('enablejsapi=1');
    expect(el.querySelector('.hc-chapter--on')?.textContent).toContain('Filling');

    // Already playing: a step pill seeks the same player instead of reloading it.
    const post = spyOn(iframe.contentWindow!, 'postMessage');
    (el.querySelector('.hc-stamp') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBe(iframe);
    expect(post.calls.allArgs().map(([message]) => JSON.parse(message as string).func)).toEqual([ 'seekTo', 'playVideo' ]);
    expect(JSON.parse(post.calls.first().args[0] as string).args).toEqual([ 42, true ]);
  });

  it('with no video good enough, says so and links to YouTube search, with no Video pill', () => {
    const fixture = howTo();
    const el: HTMLElement = fixture.nativeElement;
    section('answer').flush({ data: answer });
    section('video').flush({ data: { video: null, stepChapters: [], moreUrl: video.moreUrl } });
    fixture.detectChanges();
    expect(el.textContent).toContain('We didn\'t find a video good enough to recommend for this one.');
    expect(el.querySelector('.hc-more-videos')?.getAttribute('href')).toBe(video.moreUrl);
    expect(el.querySelector('.ec-chip--pink')).toBeNull();
    expect(el.querySelector('.hc-stamp')).toBeNull();
  });

  const row: FindTeamVideos = {
    team: 'Chicago Bears', league: 'NFL', colors: { primary: '#13244a', accent: '#c83803' }, moreUrl: 'https://www.youtube.com/channel/UCx/videos',
    videos: [
      { id: 'aaaaaaaaaaa', title: 'Bears vs. Packers', type: 'Highlights', channel: 'Chicago Bears', publishedAt: null, durationSec: 552, duration: '9:12', embeddable: true },
      { id: 'bbbbbbbbbbb', title: 'Ben Johnson press conference', type: 'Press conference', channel: 'Chicago Bears', publishedAt: null, durationSec: 845, duration: '14:05', embeddable: true },
      { id: 'ccccccccccc', title: 'Top plays of Week 11', type: 'Top plays', channel: 'NFL', publishedAt: null, durationSec: 400, duration: '6:40', embeddable: false },
    ],
  };

  function teamRow () {
    const fixture = TestBed.createComponent(FindTeamVideosComponent);
    fixture.componentInstance.entity = { type: 'sports', league: 'nfl', label: 'NFL team', id: '3', name: 'Chicago Bears', logoUrl: null } as FindEntity;
    fixture.componentInstance.ngOnChanges({ entity: {} as any });
    section('videos').flush({ data: row });
    fixture.detectChanges();
    return fixture;
  }

  it('team videos: nothing plays until the main curtain is clicked; a small one swaps up and plays, the old main drops into its spot closed', fakeAsync(() => {
    const fixture = teamRow();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.querySelector('.tv-title--main')?.textContent).toContain('Bears vs. Packers');
    expect(Array.from(el.querySelectorAll('.tv-small .tv-title')).map(t => t.textContent)).toEqual([ 'Ben Johnson press conference', 'Top plays of Week 11' ]);
    // Team colours on the curtains.
    expect((el.querySelector('.tv') as HTMLElement).style.getPropertyValue('--c1')).toBe('#13244a');

    (el.querySelector('.tv-curtains') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/aaaaaaaaaaa?autoplay=1&playsinline=1');
    expect(el.textContent).toContain('Now playing');

    // Swap in the press conference: the old main video goes to that spot, its player removed.
    (el.querySelectorAll('.tv-stage--small')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
    tick(60);
    fixture.detectChanges();
    expect(el.querySelector('iframe')?.getAttribute('src')).toContain('/embed/bbbbbbbbbbb?');
    expect(el.querySelector('.tv-title--main')?.textContent).toContain('Ben Johnson press conference');
    expect(Array.from(el.querySelectorAll('.tv-small .tv-title')).map(t => t.textContent)).toEqual([ 'Bears vs. Packers', 'Top plays of Week 11' ]);
    tick(400);

    // A video that can't be embedded still comes up front, but links out instead of playing.
    (el.querySelectorAll('.tv-stage--small')[1] as HTMLButtonElement).click();
    tick(460);
    fixture.detectChanges();
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.textContent).toContain('Plays on YouTube only');
    expect(el.querySelector('.tv-noembed a')?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=ccccccccccc');
  }));

  it('no videos, no row', () => {
    const fixture = TestBed.createComponent(FindTeamVideosComponent);
    fixture.componentInstance.entity = { type: 'sports', league: 'nfl', label: 'NFL team', id: '3', name: 'Chicago Bears', logoUrl: null } as FindEntity;
    fixture.componentInstance.ngOnChanges({ entity: {} as any });
    section('videos').flush({ data: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tv')).toBeNull();
  });

  it('curtain folds are the team colour lightened 20% and darkened 60%', () => {
    expect(curtainColors('#13244a', '#c83803')).toEqual({ '--c1': '#13244a', '--c2': '#42506e', '--c3': '#080e1e', '--gold': '#c83803' });
  });
});
