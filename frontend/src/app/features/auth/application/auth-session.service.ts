import { Injectable } from '@angular/core';
import { LoginResponse } from '../domain/models/login-response';
import { isJwtExpired } from '../../../core/auth/jwt.utils';

const STORAGE_KEY = 'dentalclinic_auth';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  setSession(auth: LoginResponse): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: auth.token,
        user: auth.user
      })
    );
  }

  getToken(): string | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const token = (JSON.parse(raw) as { token: string }).token;
      if (token && isJwtExpired(token)) {
        this.clear();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  getUser(): LoginResponse['user'] | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { user: LoginResponse['user'] }).user;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

