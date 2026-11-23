import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductPagesComponent } from '../shared/product-pages/product-pages.component';

/**
 * About Find: the shared About template (Help and About side by side, like
 * every 16Ahead app), then Find's offer in five lines, its 30-second video,
 * the product idea and what people say. The template sets the page title,
 * description, canonical and structured data. Static, so it prerenders.
 */
@Component( {
  selector: 'app-find-about',
  standalone: true,
  imports: [RouterLink, ProductPagesComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
} )
export class AboutComponent { }
