import { Observable } from 'rxjs';
import { LoginRequest } from '../models/login-request';
import { LoginResponse } from '../models/login-response';

export interface AuthRepository {
  login(request: LoginRequest): Observable<LoginResponse>;
}

