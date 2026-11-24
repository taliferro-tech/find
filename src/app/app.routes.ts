import { Routes } from '@angular/router';
import { FindHomeComponent } from './find-home/find-home.component';
import { shareLinkGuard } from './find-home/share-link';

export const routes: Routes = [
  { path: '', component: FindHomeComponent },
  // A result's short link, reached by Back/Forward after the address bar
  // was swapped to it (share-link.ts); the guard always redirects.
  { path: 's/:id', canActivate: [ shareLinkGuard ], component: FindHomeComponent },
  {
    path: 'help',
    loadComponent: () =>
      import( './help/help.component' ).then( ( m ) => m.HelpComponent ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import( './about/about.component' ).then( ( m ) => m.AboutComponent ),
  },
  {
    path: '**',
    loadComponent: () =>
      import( './features/not-found/not-found.component' ).then( ( m ) => m.NotFoundComponent ),
  },
];
