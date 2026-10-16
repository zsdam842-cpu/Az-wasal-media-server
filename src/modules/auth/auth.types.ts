export interface RegisterInput {
  displayName: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface AuthUser {
  id: string;
  phone: string | null;
  username: string | null;
  wasalCode: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}
