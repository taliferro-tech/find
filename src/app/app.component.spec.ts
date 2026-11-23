import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { AppComponent, isProductPage } from './app.component';
import { HOW_TO_SHORTS, WAITING_SHORTS } from './help/help.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'find' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('find');
  });

  it('should render the find-home page via the router', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await router.navigateByUrl('/');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-find-home')).toBeTruthy();
  });

  it('hides the iPhone banner only on Help and About (it covered their toggle)', () => {
    expect(['/help', '/about', '/about/', '/help?x=1', '/about#offer'].every(isProductPage)).toBeTrue();
    expect(['/', '/guides', '/helpers', '/s/abc', '/about-us'].some(isProductPage)).toBeFalse();
  });

  it('Help shows only public how-to Shorts, each with a title', () => {
    expect(HOW_TO_SHORTS.length).toBeGreaterThan(0);
    expect(HOW_TO_SHORTS.every((s) => /^[\w-]{11}$/.test(s.id) && s.title.length > 5)).toBeTrue();
    expect(HOW_TO_SHORTS.some((s) => WAITING_SHORTS.includes(s.id))).toBeFalse();
  });
});
