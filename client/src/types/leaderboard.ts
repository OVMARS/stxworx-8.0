export interface ApiLeaderboardEntry {
  id: number;
  stxAddress: string;
  username?: string | null;
  jobsCompleted: number;
  avgRating: number;
  reviewCount: number;
  createdAt?: string;
  rank: number;
}
