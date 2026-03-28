import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthSessionService } from '../../features/auth/application/auth-session.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private readonly session: AuthSessionService,
    private readonly router: Router
  ) {}

  canActivate(): boolean {
    const token = this.session.getToken();
    if (token) return true;
    this.router.navigate(['/login']);
    return false;
  }
}

