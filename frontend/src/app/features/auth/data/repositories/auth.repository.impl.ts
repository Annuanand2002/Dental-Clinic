import { Injectable, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthRepository } from '../../domain/repositories/auth.repository';
import { LoginRequest } from '../../domain/models/login-request';
import { LoginResponse } from '../../domain/models/login-response';
import { AuthApiService } from '../services/auth-api.service';

@Injectable()
export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly api: AuthApiService) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api.login(request);
  }
}

