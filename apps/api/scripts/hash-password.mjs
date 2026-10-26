import { hash, argon2id } from 'argon2';

// Herramienta local: genera un hash, no conecta ni escribe en SQL.
if (!process.stdin.isTTY) {
  throw new Error(
    'Ejecuta este comando en una terminal interactiva; no pases la contraseña por argumentos.',
  );
}
process.stderr.write('Contraseña (12–128 caracteres, entrada oculta): ');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.resume();
try {
  const password = await new Promise((resolve, reject) => {
    let value = '';
    const listener = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') {
          process.stdin.off('data', listener);
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          process.stdin.off('data', listener);
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b')
          value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on('data', listener);
  });
  if (password.length < 12 || password.length > 128)
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  process.stdout.write(`${await hash(password, { type: argon2id })}\n`);
} finally {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stderr.write('\n');
}
