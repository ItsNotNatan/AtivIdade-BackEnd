// src/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function iniciarBanco() {
    let pastaBanco = path.join(__dirname, '..');

    // Tenta usar /data apenas se o disco persistente realmente existir e for gravável
    if (fs.existsSync('/data')) {
        try {
            fs.accessSync('/data', fs.constants.W_OK);
            pastaBanco = '/data';
        } catch {
            pastaBanco = path.join(__dirname, '..');
        }
    }

    const caminhoArquivo = path.join(pastaBanco, 'database.sqlite');

    return open({
        filename: caminhoArquivo,
        driver: sqlite3.Database
    });
}