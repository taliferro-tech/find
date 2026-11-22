import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FindEntity, FindExperienceService } from '../../services/find-experience.service';
import { FindPlacePageComponent } from './find-place-page.component';

const location = {
  name: 'Calle Del Mar', address: '123 Main St, Los Angeles, CA 90012, USA', shortAddress: '123 Main St', city: 'Los Angeles', phone: '(213) 555-0100',
  distanceMi: 2.4, openNow: true, open24Hours: false, nextCloseTime: null, nextOpenTime: null, utcOffsetMinutes: -480, mapsUrl: 'https://maps.test/1', directionsUrl: 'https://maps.test/dir',
};
const place = {
  nearest: location, others: [], usedPosition: true, rating: { value: 4.9, count: 64 }, priceLevel: '$$$', category: 'Knitwear boutique', website: 'https://calle.test/',
  hoursWeek: [ 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' ].map( day => ( { day, hours: '10:00 AM – 2:00 PM, 4:00 – 8:00 PM' } ) ),
  serves: [ 'Breakfast', 'Lunch' ], about: '', photoUrl: 'https://img.test/1.jpg',
  photos: [ 1, 2, 3, 4, 5 ].map( n => ( { url: `https://img.test/${ n }.jpg`, author: 'Ana', authorUrl: '' } ) ), photoCount: 10, priceRange: '$10–20', placeId: 'p1',
};
const reviews = {
  rating: 4.9, count: 64, grouped: 5, mapsUrl: 'https://maps.test/1',
  themes: [ { text: 'Soft cashmere', count: 4, tone: 'green' }, { text: 'Runs small', count: 3, tone: 'amber' } ],
  quotes: [ { text: 'The softest sweater I own.', stars: 5, date: '2026-11-02T00:00:00Z', author: 'Jo' } ],
};

describe( 'FindPlacePageComponent', () => {
  let fixture: ComponentFixture<FindPlacePageComponent>;
  let service: jasmine.SpyObj<FindExperienceService>;
  let sections: Record<string, unknown>;

  beforeEach( async () => {
    service = jasmine.createSpyObj<FindExperienceService>( 'FindExperienceService', [ 'entitySection', 'askStore', 'createWatch', 'removeWatch' ] );
    service.entitySection.and.callFake( ( ( _: FindEntity, section: string ) => of( { data: sections[ section ] ?? null } ) ) as never );
    await TestBed.configureTestingModule( { imports: [ FindPlacePageComponent ], providers: [ { provide: FindExperienceService, useValue: service } ] } ).compileComponents();
  } );

  afterEach( () => fixture?.destroy() );

  function render ( type: 'restaurant' | 'store', id = 'calle del mar' ): HTMLElement {
    const entity: FindEntity = { type, label: type === 'store' ? 'Clothing store' : 'Diner', id, name: type === 'store' ? 'Calle Del Mar' : 'Young’s Restaurant', logoUrl: null };
    fixture = TestBed.createComponent( FindPlacePageComponent );
    fixture.componentRef.setInput( 'entity', entity );
    fixture.componentRef.setInput( 'query', entity.name );
    fixture.componentInstance.ngOnChanges( { entity: { currentValue: entity } as never } );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it( 'a restaurant: photos, popular dishes, price range, What people say and compact hours', () => {
    sections = {
      place, reviews,
      summary: { text: 'A neighborhood diner.', sources: [ 'Google' ] },
      dishes: { menuUrl: 'https://calle.test/menu', dishes: [ { name: 'Chow mein', note: 'Mentioned in 3 reviews', price: '$13.95' }, { name: 'Country breakfast', note: 'Two eggs', price: '$11.50' } ] },
    };
    const el = render( 'restaurant' );
    expect( el.querySelectorAll( '.pp-strip__item' ).length ).toBe( 4 );
    expect( el.textContent ).toContain( 'See all 10 photos' );
    expect( el.textContent ).toContain( 'Chow mein' );
    expect( el.textContent ).toContain( 'Mentioned in 3 reviews' );
    expect( el.textContent ).toContain( '$ · $10–20' );
    expect( el.textContent ).toContain( 'Soft cashmere · 4 mentions' );
    expect( el.textContent ).toContain( '“The softest sweater I own.”' );
    expect( el.querySelector( '.pp-hours__row' )?.textContent ).toContain( '10 AM–2 PM · 4–8 PM' );
    expect( el.querySelector( '.ec-action--primary' )?.getAttribute( 'href' ) ).toBe( 'https://calle.test/menu' );
    expect( el.querySelector( '.pp-tile' )?.textContent?.trim() ).toBe( 'Y' );
  } );

  it( 'a store on 16Ahead Store: quick facts, Shop online, Ask this store and its referral', () => {
    sections = {
      place, reviews,
      retail: { knownFor: 'Cashmere', madeIn: 'Los Angeles', prices: '$85–$420', returns: '30 days', shipsNationwide: true, fitNote: '', instagram: 'https://www.instagram.com/calle/', shop: { name: 'Calle Del Mar', slug: 'calle-del-mar', url: 'https://16ahead.store/calle-del-mar' } },
      products: { source: '16ahead', title: 'Best sellers from their 16Ahead Store', total: 38, seeAllUrl: 'https://16ahead.store/calle-del-mar?view=all', products: [ { title: 'Fair Isle cardigan', price: '$295', imageUrl: null, url: 'https://16ahead.store/x', stock: 'in' } ] },
    };
    service.askStore.and.returnValue( of( { result: { count: 0, best: null, searchUrl: 'https://16ahead.store/calle-del-mar?q=kids', referral: { store: 'Linden Knits', location: 'Pasadena', url: 'https://16ahead.store/linden-knits', heading: 'Kids sweaters' } } } ) );
    const el = render( 'store' );
    expect( el.textContent ).toContain( 'On 16Ahead Store' );
    expect( el.textContent ).toContain( 'Cashmere' );
    expect( el.textContent ).toContain( 'also ships across the US' );
    expect( el.textContent ).toContain( 'See all 38' );
    expect( el.textContent ).toContain( 'In stock' );
    expect( el.querySelector( '.pp-tile' )?.textContent?.trim() ).toBe( 'CD' );

    fixture.componentInstance.askQuery = 'kids sweater';
    fixture.componentInstance.ask();
    fixture.detectChanges();
    expect( service.askStore ).toHaveBeenCalledWith( 'calle-del-mar', 'kids sweater' );
    expect( el.textContent ).toContain( 'sends you to Linden Knits in Pasadena' );
  } );

  it( 'an online-only shop from our Store guides: product photos, no visit card, buy or claim it (2026-11-21)', () => {
    const online = { ...place, nearest: null, rating: null, hoursWeek: [], placeId: '', photoCount: 3, photos: place.photos.slice( 0, 3 ), name: 'Argent Inc', city: 'San Francisco, CA', online: true };
    sections = {
      place: online, reviews: null,
      retail: { knownFor: 'Seasonless wool', madeIn: '', prices: '', returns: '', shipsNationwide: false, fitNote: '', instagram: '', shop: null, listing: { wantUrl: 'https://16ahead.store/stores?want=argentwork.com', claimUrl: 'https://16ahead.store/claim/argentwork.com' } },
      products: null,
    };
    const el = render( 'store', 'listing:argentwork.com' );
    expect( el.textContent ).toContain( 'In our Store guides' );
    expect( el.textContent ).toContain( 'San Francisco, CA' );
    expect( el.textContent ).toContain( 'Shops online' );
    expect( el.querySelector( '.pp-visit' ) ).toBeNull();
    expect( el.querySelector( '.pp-hours' ) ).toBeNull();
    expect( el.querySelector( '.pp-listed__want' )?.getAttribute( 'href' ) ).toBe( 'https://16ahead.store/stores?want=argentwork.com' );
    expect( el.querySelector( '.pp-listed__claim' )?.getAttribute( 'href' ) ).toBe( 'https://16ahead.store/claim/argentwork.com' );
  } );

  it( 'a store with nothing extra hides those sections', () => {
    sections = { place, reviews: null, retail: { knownFor: '', madeIn: '', prices: '', returns: '', shipsNationwide: false, fitNote: '', instagram: '', shop: null }, products: null };
    const el = render( 'store' );
    expect( el.querySelector( '.pp-ask' ) ).toBeNull();
    expect( el.querySelector( '.pp-shop' ) ).toBeNull();
    expect( el.querySelector( 'app-find-reviews-block' ) ).toBeNull();
    expect( el.querySelector( '.pp-facts' ) ).toBeNull();
  } );
} );
