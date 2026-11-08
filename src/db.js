import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function iniciarBanco() {
    // Se estiver no Render, usa a pasta do disco persistente (/data). Se for local, usa a raiz do projeto.
    const isProduction = process.env.NODE_ENV === 'production';
    const dbDir = isProduction ? '/data' : path.join(__dirname, '..');
    
    // Garante que a pasta existe antes de criar o ficheiro SQLite
    if (isProduction && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = path.join(dbDir, 'database.sqlite');

    return open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}