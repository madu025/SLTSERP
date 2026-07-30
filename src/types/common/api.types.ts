export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: {
    timestamp: Date;
    requestId: string;
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}