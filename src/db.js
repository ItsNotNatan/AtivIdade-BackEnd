// src/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Garante o carregamento do .env a partir da raiz do projeto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Função simplificada: como o server.js já tem as aspas duplas, 
// agora apenas convertemos os "?" para "$1, $2", etc.
function adaptarParaPostgres(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

export async function iniciarBanco() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("ERRO: DATABASE_URL não definida nas variáveis de ambiente!");
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    return {
        async get(sql, params = []) {
            const res = await pool.query(adaptarParaPostgres(sql), params);
            return res.rows[0];
        },
        async all(sql, params = []) {
            const res = await pool.query(adaptarParaPostgres(sql), params);
            return res.rows;
        },
        async run(sql, params = []) {
            const res = await pool.query(adaptarParaPostgres(sql), params);
            return { rowCount: res.rowCount };
        }
    };
}