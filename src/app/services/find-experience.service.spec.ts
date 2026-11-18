import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FindExperienceService, FindSearchEvent } from './find-experience.service';

describe('FindExperienceService', () => {
  let service: FindExperienceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FindExperienceService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FindExperienceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('forwards a five-digit ZIP code separately for weather searches', () => {
    service.search({ query: 'weather 98106', maxResults: 1 }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'weather 98106',
      context: null,
      postalCode: '98106',
      maxResults: 1,
      timeZone: jasmine.any(String),
      features: ['instant', 'units'],
    });
    request.flush({ success: true, query: 'weather 98106', normalizedQuery: 'weather 98106', queryType: 'weather', results: [], selectedIndex: 0 });
  });

  it('does not add a ZIP field to ordinary searches', () => {
    service.search({ query: 'weather tomorrow' }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'weather tomorrow',
      context: null,
      maxResults: 16,
      timeZone: jasmine.any(String),
      features: ['instant', 'units'],
    });
    request.flush({ success: true, query: 'weather tomorrow', normalizedQuery: 'weather tomorrow', queryType: 'weather', results: [], selectedIndex: 0 });
  });

  it('forwards coordinates for a "near me" search when a position is available', () => {
    service.search({ query: 'places to eat near me', latitude: 47.5218, longitude: -122.3466 }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'places to eat near me',
      context: null,
      latitude: 47.5218,
      longitude: -122.3466,
      maxResults: 16,
      timeZone: jasmine.any(String),
      features: ['instant', 'units'],
    });
    request.flush({ success: true, query: 'places to eat near me', normalizedQuery: 'places to eat near me', queryType: 'local', results: [], selectedIndex: 0 });
  });

  it('omits coordinates when geolocation was denied or unavailable', () => {
    service.search({ query: 'places to eat near me', latitude: null, longitude: null }).subscribe();

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    expect(request.request.body).toEqual({
      query: 'places to eat near me',
      context: null,
      maxResults: 16,
      timeZone: jasmine.any(String),
      features: ['instant', 'units'],
    });
    request.flush({ success: true, query: 'places to eat near me', normalizedQuery: 'places to eat near me', queryType: 'entity', results: [], selectedIndex: 0 });
  });

  it('falls back to a deterministic local conversion when the backend has not classified it', () => {
    let response: any;
    service.search({ query: '10 miles to kilometers' }).subscribe(value => response = value);

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    request.flush({ success: true, query: '10 miles to kilometers', normalizedQuery: '10 miles to kilometers', queryType: 'entity', results: [], selectedIndex: 0 });

    expect(response.queryType).toBe('conversion');
    expect(response.conversion.category).toBe('distance');
    expect(response.conversion.outputAmount).toBeCloseTo(16.09344, 4);
    expect(response.conversion.source).toBe('Find local conversion');
  });

  it('does not invent a currency rate when the backend has not supplied one', () => {
    let response: any;
    service.search({ query: '100 usd to yen' }).subscribe(value => response = value);

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    request.flush({ success: true, query: '100 usd to yen', normalizedQuery: '100 usd to yen', queryType: 'entity', results: [], selectedIndex: 0 });

    expect(response.queryType).toBe('entity');
    expect(response.conversion).toBeUndefined();
  });

  it('turns a prose currency answer into a calculator when a numeric result is present', () => {
    let response: any;
    service.search({ query: '100 USD to JPY' }).subscribe(value => response = value);

    const request = http.expectOne( item => item.url.endsWith('/find/search') );
    request.flush({
      success: true,
      query: '100 USD to JPY',
      normalizedQuery: '100 USD to JPY',
      queryType: 'question',
      answer: {
        text: '100 US dollars is approximately 15,621.7 Japanese yen.',
        references: []
      },
      results: [],
      selectedIndex: 0
    });

    expect(response.queryType).toBe('conversion');
    expect(response.conversion.category).toBe('currency');
    expect(response.conversion.outputAmount).toBeCloseTo(15621.7, 1);
    expect(response.conversion.rate).toBeCloseTo(156.217, 3);
    expect(response.conversion.source).toBe('Find results');
  });


  describe('results first (2026-11-17)', () => {
    const line = (message: unknown) => JSON.stringify(message) + '\n';
    const final = { success: true, query: 'acme', normalizedQuery: 'acme', queryType: 'entity', results: [{ url: 'https://acme.example/', title: 'Acme', imageUrl: 'https://acme.example/og.png' }], selectedIndex: 0 };

    it('streams the stage and the early cards before the full response', () => {
      const events: FindSearchEvent[] = [];
      service.searchStream({ query: 'acme' }).subscribe(event => events.push(event));
      const request = http.expectOne(item => item.url.endsWith('/find/search'));
      expect(request.request.body.stream).toBeTrue();
      expect(request.request.responseType).toBe('text');

      const early = line({ type: 'stage', stage: 'planning' })
        + line({ type: 'results', query: 'acme', queryType: 'entity', results: [{ url: 'https://acme.example/', title: 'Acme' }] })
        + line({ type: 'stage', stage: 'checking', pageCount: 3 })
        + '{"type":"fin'; // a message still arriving is not read yet
      request.event({ type: HttpEventType.DownloadProgress, loaded: early.length, partialText: early } as any);
      expect(events.map(event => event.type)).toEqual(['stage', 'results', 'stage']);
      expect((events[1] as any).response.results[0].url).toBe('https://acme.example/');
      expect((events[2] as any).pageCount).toBe(3);

      const whole = early.slice(0, early.lastIndexOf('\n') + 1) + line({ type: 'final', response: final });
      request.flush(whole);
      expect(events.map(event => event.type)).toEqual(['stage', 'results', 'stage', 'final']);
      expect((events[3] as any).response.results[0].imageUrl).toBe('https://acme.example/og.png');
    });

    it('reads a plain JSON reply (no stream) as the full response', () => {
      const events: FindSearchEvent[] = [];
      service.searchStream({ query: 'acme' }).subscribe(event => events.push(event));
      http.expectOne(item => item.url.endsWith('/find/search')).flush(JSON.stringify(final));
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('final');
    });

    it('turns a stream error message into an error', () => {
      let failed = '';
      service.searchStream({ query: 'acme' }).subscribe({ error: (err) => (failed = err.message) });
      http.expectOne(item => item.url.endsWith('/find/search')).flush(line({ type: 'stage', stage: 'planning' }) + line({ type: 'error', message: 'Find search failed' }));
      expect(failed).toBe('Find search failed');
    });
  });
});
