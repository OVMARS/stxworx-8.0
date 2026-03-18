export type UserRole = 'client' | 'freelancer';

export interface ApiUserProfile {
  id: number;
  stxAddress: string;
  username?: string | null;
  role: UserRole;
  isActive: boolean;
  totalEarned?: string | number | null;
  specialty?: string | null;
  hourlyRate?: string | null;
  about?: string | null;
  skills?: string[] | null;
  portfolio?: string[] | null;
  company?: string | null;
  projectInterests?: string[] | null;
  avatar?: string | null;
  createdAt?: string;
}

export interface ApiUserReview {
  id: number;
  projectId: number;
  reviewerId: number;
  revieweeId: number;
  rating: number;
  comment?: string | null;
  createdAt?: string;
}

export interface AuthenticatedUser {
  id: number;
  stxAddress: string;
  username?: string | null;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
}

export interface AuthenticatedUserResponse {
  user: AuthenticatedUser;
}
