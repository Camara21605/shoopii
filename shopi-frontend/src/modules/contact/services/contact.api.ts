import { apiFetch } from '../../../shared/services/apiFetch';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  body: string;
  type?: string;
}

export const contactApi = {
  submit: (payload: ContactPayload) =>
    apiFetch<{ id: string; reference: string }>('/contact', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),
};
