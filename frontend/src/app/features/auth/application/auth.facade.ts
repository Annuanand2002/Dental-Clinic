import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoginUseCase } from '../domain/use-cases/login.usecase';
import { AuthSessionService } from './auth-session.service';
import { LoginResponse } from '../domain/models/login-response';
import { LoginRequest } from '../domain/models/login-request';

@Injectable()
export class AuthFacade {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly authSession: AuthSessionService
  ) {}

  login(usernameOrEmail: string, password: string): Observable<LoginResponse> {
    const req: LoginRequest = { usernameOrEmail, password };
    return this.loginUseCase.execute(req).pipe(
      tap((res) => this.authSession.setSession(res))
    );
  }

  get token(): string | null {
    return this.authSession.getToken();
  }

  logout(): void {
    this.authSession.clear();
  }
}

