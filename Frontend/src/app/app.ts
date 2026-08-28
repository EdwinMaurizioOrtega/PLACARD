import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly fallbackAvatar = 'https://picsum.photos/seed/placard-user/80/80';
  protected readonly locating = signal(false);
  protected readonly locationError = signal('');

  ngOnInit() {
    this.auth.watchGeoPermission();
    if (this.auth.isLoggedIn()) {
      this.auth.syncLocation().subscribe();
    }
  }

  protected geoTitle(): string {
    switch (this.auth.geoStatus()) {
      case 'granted':
        return 'Estamos ordenando las prendas por tu distancia real';
      case 'denied':
        return 'Bloqueaste la ubicación para este sitio en tu navegador';
      case 'unavailable':
        return 'Tu navegador no soporta geolocalización';
      default:
        return 'Sin ubicación no podemos priorizar prendas cercanas';
    }
  }

  protected enableLocation() {
    this.locating.set(true);
    this.locationError.set('');
    this.auth.syncLocation().subscribe((ok) => {
      this.locating.set(false);
      if (ok) return;
      this.locationError.set(
        this.auth.geoStatus() === 'denied'
          ? 'Bloqueaste la ubicación para este sitio. Habilítala desde el candado de la barra de direcciones y vuelve a intentarlo.'
          : 'No pudimos obtener tu ubicación. Revisa los permisos del navegador para este sitio.',
      );
    });
  }
}
