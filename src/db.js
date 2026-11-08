// src/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function iniciarBanco() {
    const isProduction = process.env.NODE_ENV === 'production';
    const pastaBanco = isProduction ? '/data' : path.join(__dirname, '..');

    if (isProduction && !fs.existsSync(pastaBanco)) {
        fs.mkdirSync(pastaBanco, { recursive: true });
    }

    const caminhoArquivo = path.join(pastaBanco, 'database.sqlite');

    return open({
        filename: caminhoArquivo,
        driver: sqlite3.Database
    });
}