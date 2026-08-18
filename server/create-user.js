// Crée ou met à jour un compte GymOS. Usage : node create-user.js <username>
// Le mot de passe est saisi de façon masquée dans le terminal (jamais en argument
// de ligne de commande, jamais loggé) et haché avec scrypt avant stockage.
const db = require('./db');
const { hashPassword } = require('./auth');

const KEY_ENTER1 = String.fromCharCode(10);      // \n
const KEY_ENTER2 = String.fromCharCode(13);      // \r
const KEY_EOF = String.fromCharCode(4);          // Ctrl+D
const KEY_CTRL_C = String.fromCharCode(3);       // Ctrl+C
const KEY_BACKSPACE1 = String.fromCharCode(127); // Delete/Backspace
const KEY_BACKSPACE2 = String.fromCharCode(8);   // \b

function askHidden(promptText) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(promptText);
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      if (char === KEY_ENTER1 || char === KEY_ENTER2 || char === KEY_EOF) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === KEY_CTRL_C) {
        process.stdout.write('\n');
        process.exit(1);
        return;
      }
      if (char === KEY_BACKSPACE1 || char === KEY_BACKSPACE2) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on('data', onData);
  });
}

(async () => {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage : node create-user.js <username>');
    process.exit(1);
  }

  const pw1 = await askHidden(`Mot de passe pour "${username}" : `);
  if (pw1.length < 8) {
    console.error('Mot de passe trop court (8 caractères minimum).');
    process.exit(1);
  }
  const pw2 = await askHidden('Confirmer le mot de passe : ');
  if (pw1 !== pw2) {
    console.error('Les mots de passe ne correspondent pas.');
    process.exit(1);
  }

  db.upsertUser(username, hashPassword(pw1));
  console.log(`Compte "${username}" créé/mis à jour avec succès.`);
  process.exit(0);
})();
