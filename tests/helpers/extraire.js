// Les fonctions serveur (Deno, TypeScript) ne peuvent pas être importées telles quelles dans les tests.
// On en extrait le texte d'une fonction précise, on retire les types avec esbuild, et on l'exécute.
// Sert à vérifier que les COPIES de calculs présentes côté serveur restent identiques à celles de l'application.
import fs from 'node:fs';
import path from 'node:path';
import { transformSync } from 'esbuild';

const RACINE = path.resolve(import.meta.dirname, '../..');

export function lireFonctionServeur(nomFonction) {
  return fs.readFileSync(path.join(RACINE, 'supabase/functions', nomFonction, 'index.ts'), 'utf8');
}

// Texte complet de « function nom(...) { ... } » : on saute d'abord la liste des paramètres (qui peut contenir des
// accolades de type TypeScript), puis on suit les accolades du corps.
export function extraireFonction(source, nom) {
  const debut = source.search(new RegExp(`(^|\\n)(async )?function ${nom}\\s*[<(]`));
  if (debut < 0) throw new Error(`fonction « ${nom} » introuvable`);
  let i = source.indexOf('(', debut);
  let parentheses = 0;
  for (; i < source.length; i++) {
    if (source[i] === '(') parentheses++;
    if (source[i] === ')') { parentheses--; if (parentheses === 0) break; }
  }
  i = source.indexOf('{', i); // début du corps (après le type de retour éventuel)
  let accolades = 0;
  let fin = i;
  for (; fin < source.length; fin++) {
    if (source[fin] === '{') accolades++;
    if (source[fin] === '}') { accolades--; if (accolades === 0) break; }
  }
  return source.slice(source.indexOf('function', debut), fin + 1).replace(/^async /, '');
}

export function extraireConstante(source, nom) {
  const m = source.match(new RegExp(`const ${nom}[^=]*=[^;]*;`));
  if (!m) throw new Error(`constante « ${nom} » introuvable`);
  return m[0];
}

// Compile et exécute des morceaux de TypeScript, et renvoie les fonctions demandées.
export function compiler(morceaux, exportes) {
  const js = transformSync(morceaux.join('\n\n'), { loader: 'ts', format: 'esm' }).code;
  // eslint-disable-next-line no-new-func
  return new Function(`${js}\nreturn { ${exportes.join(', ')} };`)();
}
