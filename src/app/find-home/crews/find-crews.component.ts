import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FindCrew, FindExperienceService } from '../../services/find-experience.service';

/**
 * Crews on the Awards screen: small private friends boards (this week's
 * points, rank, streak and today's Daily Find), made here and joined with
 * an invite link or code (backend findCrews.service.js).
 */
@Component( {
  selector: 'app-find-crews',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './find-crews.component.html',
  styleUrl: './find-crews.component.css'
} )
export class FindCrewsComponent implements OnInit {
  crews: FindCrew[] = [];
  loading = true;
  newName = '';
  joinCode = '';
  creating = false;
  joining = false;
  message = '';
  copied = '';

  constructor ( private readonly findExperience: FindExperienceService ) { }

  ngOnInit (): void {
    this.findExperience.crews().subscribe( {
      next: ( response ) => { this.crews = response.crews || []; this.loading = false; },
      error: () => { this.loading = false; },
    } );
  }

  create (): void {
    const name = this.newName.trim();
    if ( name.length < 2 ) return;
    this.creating = true;
    this.message = '';
    this.findExperience.createCrew( name ).subscribe( {
      next: ( response ) => {
        this.creating = false;
        this.newName = '';
        this.crews = [ ...this.crews, response.crew ];
        this.message = `Made “${ response.crew.name }”. Invite people with its link.`;
      },
      error: ( err ) => { this.creating = false; this.message = err?.error?.message || 'Couldn’t make that crew.'; },
    } );
  }

  join (): void {
    const code = this.joinCode.trim();
    if ( !code ) return;
    this.joining = true;
    this.message = '';
    this.findExperience.joinCrew( code ).subscribe( {
      next: ( response ) => {
        this.joining = false;
        this.joinCode = '';
        this.crews = [ ...this.crews.filter( crew => crew.code !== response.crew.code ), response.crew ];
        this.message = `You joined “${ response.crew.name }”.`;
      },
      error: ( err ) => { this.joining = false; this.message = err?.error?.message || 'Couldn’t join that crew.'; },
    } );
  }

  leave ( crew: FindCrew ): void {
    this.findExperience.leaveCrew( crew.code ).subscribe( {
      next: () => {
        this.crews = this.crews.filter( item => item.code !== crew.code );
        this.message = `You left “${ crew.name }”.`;
      },
      error: () => { this.message = 'Couldn’t leave that crew. Try again.'; },
    } );
  }

  async invite ( crew: FindCrew ): Promise<void> {
    const text = `Join my crew “${ crew.name }” on Find and let’s see who scores more this week.`;
    try {
      if ( typeof navigator !== 'undefined' && navigator.share ) {
        await navigator.share( { title: `${ crew.name } on Find`, text, url: crew.inviteUrl } );
        return;
      }
      await navigator.clipboard?.writeText( `${ text } ${ crew.inviteUrl }` );
      this.copied = crew.code;
    } catch {
      // The share sheet was closed.
    }
  }

  trackByCode ( _: number, crew: FindCrew ): string {
    return crew.code;
  }
}
