export interface SurveyGuruApiClientOptions {
  baseUrl: string;
  getIdToken?: () => Promise<string | null>;
}

export class SurveyGuruApiClient {
  constructor(private readonly options: SurveyGuruApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.getIdToken?.();
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await fetch(`${this.options.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`Survey Guru API request failed (${response.status})`);
    return response.json() as Promise<T>;
  }
}
