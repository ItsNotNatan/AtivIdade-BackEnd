// src/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Função que traduz o SQLite para o dialecto do PostgreSQL
function adaptarParaPostgres(sql) {
    let index = 1;
    
    // 1. Converte os pontos de interrogação (?) para $1, $2, etc.
    let parsedSql = sql.replace(/\?/g, () => `$${index++}`);
    
    // 2. Protege os nomes das tabelas com aspas duplas (Exigência rigorosa do Postgres)
    parsedSql = parsedSql
        .replace(/\bUser\b/g, '"User"')
        .replace(/\bTurma\b/g, '"Turma"')
        .replace(/\bTurmaAluno\b/g, '"TurmaAluno"')
        .replace(/\bPrescricao\b/g, '"Prescricao"')
        .replace(/\bAtividade\b/g, '"Atividade"')
        .replace(/\bAlerta\b/g, '"Alerta"')
        .replace(/\bAcervo\b/g, '"Acervo"');
        
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