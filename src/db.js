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

// Função que traduz o SQLite para o dialeto do PostgreSQL
function adaptarParaPostgres(sql) {
    let index = 1;
    
    // 1. Converte ? para $1, $2, etc.
    let parsedSql = sql.replace(/\?/g, () => `$${index++}`);
    
    // 2. Protege os nomes das tabelas com aspas duplas (exigência do Postgres)
    parsedSql = parsedSql
        .replace(/\bUser\b/g, '"User"')
        .replace(/\bTurma\b/g, '"Turma"')
        .replace(/\bTurmaAluno\b/g, '"TurmaAluno"')
        .replace(/\bPrescricao\b/g, '"Prescricao"')
        .replace(/\bAtividade\b/g, '"Atividade"')
        .replace(/\bAlerta\b/g, '"Alerta"')
        .replace(/\bAcervo\b/g, '"Acervo"');
        
    // 3. Protege os nomes das colunas camelCase com aspas duplas
    parsedSql = parsedSql
        .replace(/\bdataCriacao\b/g, '"dataCriacao"')
        .replace(/\bprofissionalId\b/g, '"profissionalId"')
        .replace(/\busuarioId\b/g, '"usuarioId"')
        .replace(/\bturmaId\b/g, '"turmaId"')
        .replace(/\bduracaoMinutos\b/g, '"duracaoMinutos"')
        .replace(/\bduracaoSegundos\b/g, '"duracaoSegundos"')
        .replace(/\bfocoMuscular\b/g, '"focoMuscular"')
        .replace(/\bgifUrl\b/g, '"gifUrl"')
        .replace(/\bdiasDaSemana\b/g, '"diasDaSemana"')
        .replace(/\bregistroProfissional\b/g, '"registroProfissional"')
        .replace(/\bcontatoEmergenciaNome\b/g, '"contatoEmergenciaNome"')
        .replace(/\bcontatoEmergenciaTel\b/g, '"contatoEmergenciaTel"');

    return parsedSql;
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