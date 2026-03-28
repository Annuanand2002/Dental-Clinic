import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../repositories/auth.repository';
import { LoginRequest } from '../models/login-request';
import { LoginResponse } from '../models/login-response';
import { AUTH_REPOSITORY } from '../../application/tokens/auth-repository.token';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository
  ) {}

  execute(request: LoginRequest): Observable<LoginResponse> {
    return this.authRepository.login(request);
  }
}

