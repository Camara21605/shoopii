import { MessagerieService } from './messagerie.service';

describe('MessagerieService.callPreview — aperçu d’une trace d’appel', () => {
  it.each([
    [{ status: 'completed', callType: 'video', duration: 75 }, '📞 Appel vidéo · 1:15'],
    [{ status: 'completed', callType: 'audio' }, '📞 Appel audio'],
    [{ status: 'missed', callType: 'audio' }, '📞 Appel audio manqué'],
    [{ status: 'cancelled', callType: 'video' }, '📞 Appel vidéo annulé'],
    [{ status: 'rejected' }, '📞 Appel audio refusé'],
    [{ status: 'busy' }, '📞 Correspondant occupé'],
  ])('%j → %s', (meta, expected) => {
    expect(MessagerieService.callPreview(JSON.stringify(meta))).toBe(expected);
  });
  it('contenu abîmé → « Appel », jamais le JSON brut', () => {
    expect(MessagerieService.callPreview('{oops')).toBe('📞 Appel');
  });
});
