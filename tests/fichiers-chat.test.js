// Fichiers du Chat : nom, type, adresse signée, préparation pour le partage, partage et enregistrement.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const signer = vi.fn();
vi.mock('../src/lib/supabase.js', () => ({ supabase: { storage: { from: (b) => ({ createSignedUrl: (...a) => signer(b, ...a) }) } } }));

const { nomFichierChat, typeParNom, partageDisponible, adresseFichierChat, preparerFichierChat, partagerFichierChat, enregistrerFichierChat } = await import('../src/lib/fichiersChat.js');

let n = 0;
const msg = (extra = {}) => ({ id: `m${++n}`, file_url: `S/C/${n}-abc.png`, file_type: 'image', file_name: 'photo classe.png', ...extra });

beforeEach(() => {
  signer.mockReset();
  signer.mockResolvedValue({ data: { signedUrl: 'https://stockage/signe' }, error: null });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('nom et type', () => {
  it('garde le nom choisi par l\'expéditeur, sinon la fin du chemin, sinon « fichier »', () => {
    expect(nomFichierChat({ file_name: 'Bulletin.pdf', file_url: 'S/C/1.pdf' })).toBe('Bulletin.pdf');
    expect(nomFichierChat({ file_name: ' ', file_url: 'S/C/17000-ab12.jpg?x=1' })).toBe('17000-ab12.jpg');
    expect(nomFichierChat({})).toBe('fichier');
  });
  it('type par extension', () => {
    expect(typeParNom('a.PNG')).toBe('image/png');
    expect(typeParNom('liste.pdf')).toBe('application/pdf');
    expect(typeParNom('inconnu.zzz')).toBe('application/octet-stream');
  });
});

describe('adresse signée', () => {
  it('lecture normale : adresse signée du stockage privé « chat-files »', async () => {
    const m = msg();
    expect(await adresseFichierChat(m)).toBe('https://stockage/signe');
    expect(signer).toHaveBeenCalledWith('chat-files', m.file_url, 600, undefined);
  });
  it('enregistrement : le stockage est prié d\'envoyer le fichier en téléchargement, sous son vrai nom', async () => {
    const m = msg();
    await adresseFichierChat(m, { telecharger: true });
    expect(signer).toHaveBeenCalledWith('chat-files', m.file_url, 600, { download: 'photo classe.png' });
  });
  it('un ancien fichier déjà enregistré avec une adresse complète est gardé tel quel', async () => {
    expect(await adresseFichierChat(msg({ file_url: 'https://exemple.org/x.png' }))).toBe('https://exemple.org/x.png');
    expect(signer).not.toHaveBeenCalled();
  });
  it('erreur du stockage ou message sans fichier : null', async () => {
    signer.mockResolvedValue({ data: null, error: { message: 'non' } });
    expect(await adresseFichierChat(msg())).toBeNull();
    expect(await adresseFichierChat({})).toBeNull();
  });
});

function simulerPartage({ canShare = true, share = vi.fn().mockResolvedValue(undefined), fetchOk = true } = {}) {
  vi.stubGlobal('navigator', { share, canShare: vi.fn(() => canShare) });
  const fetchMock = vi.fn().mockResolvedValue({ ok: fetchOk, blob: async () => new Blob(['x'], { type: 'image/png' }) });
  vi.stubGlobal('fetch', fetchMock);
  return { share, fetchMock };
}

describe('préparation et partage', () => {
  it('partage disponible seulement si le navigateur sait partager des fichiers', () => {
    vi.stubGlobal('navigator', {});
    expect(partageDisponible()).toBe(false);
    vi.stubGlobal('navigator', { share: () => {}, canShare: () => true });
    expect(partageDisponible()).toBe(true);
  });
  it('prépare un File au bon nom et ne télécharge qu\'une fois, même appelé plusieurs fois', async () => {
    const { fetchMock } = simulerPartage();
    const m = msg();
    const [a, b] = await Promise.all([preparerFichierChat(m), preparerFichierChat(m)]);
    expect(a).toBe(b);
    expect(a.name).toBe('photo classe.png');
    expect(a.type).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('un échec de téléchargement n\'est pas gardé en mémoire : on peut réessayer', async () => {
    const m = msg();
    simulerPartage({ fetchOk: false });
    expect(await preparerFichierChat(m)).toBeNull();
    await Promise.resolve();
    simulerPartage();
    expect((await preparerFichierChat(m)).name).toBe('photo classe.png');
  });
  it('partage : ouvre la feuille de partage avec le fichier', async () => {
    const { share } = simulerPartage();
    expect(await partagerFichierChat(msg())).toBe('partage');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files[0].name).toBe('photo classe.png');
  });
  it('la personne ferme la feuille : « annule », pas une erreur', async () => {
    simulerPartage({ share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    expect(await partagerFichierChat(msg())).toBe('annule');
  });
  it('appareil sans partage de fichiers, type refusé ou fichier introuvable : « indisponible » (on propose Enregistrer)', async () => {
    vi.stubGlobal('navigator', {});
    expect(await partagerFichierChat(msg())).toBe('indisponible');
    simulerPartage({ canShare: false });
    expect(await partagerFichierChat(msg())).toBe('indisponible');
    simulerPartage({ fetchOk: false });
    expect(await partagerFichierChat(msg())).toBe('indisponible');
  });
});

describe('enregistrement', () => {
  it('lance un téléchargement (lien « download » cliqué), sans ouvrir d\'onglet', async () => {
    const lien = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => lien), body: { appendChild: vi.fn() } });
    expect(await enregistrerFichierChat(msg())).toBe(true);
    expect(lien.href).toBe('https://stockage/signe');
    expect(lien.download).toBe('photo classe.png');
    expect(lien.click).toHaveBeenCalledTimes(1);
  });
  it('adresse impossible : false, rien n\'est cliqué', async () => {
    signer.mockResolvedValue({ data: null, error: { message: 'non' } });
    const lien = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => lien), body: { appendChild: vi.fn() } });
    expect(await enregistrerFichierChat(msg())).toBe(false);
    expect(lien.click).not.toHaveBeenCalled();
  });
});
