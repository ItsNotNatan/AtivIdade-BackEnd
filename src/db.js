// src/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function iniciarBanco() {
    // Abre (ou cria) o ficheiro do banco de dados na raiz do projeto
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // Cria as tabelas se elas ainda não existirem
    await db.exec(`
        CREATE TABLE IF NOT EXISTS User (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            telemovel TEXT UNIQUE NOT NULL,
            pin TEXT NOT NULL,
            tipo TEXT NOT NULL,
            idade INTEGER,
            peso REAL,
            altura REAL,
            mobilidade TEXT,
            condicoes TEXT,
            contatoEmergenciaNome TEXT,
            contatoEmergenciaTel TEXT,
            turmaId TEXT,
            criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Turma (
            id TEXT PRIMARY KEY,
            nome TEXT NOT NULL,
            profissionalId TEXT,
            criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Atividade (
            id TEXT PRIMARY KEY,
            usuarioId TEXT NOT NULL,
            titulo TEXT NOT NULL,
            duracaoSegundos INTEGER NOT NULL,
            feedback TEXT NOT NULL,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Alerta (
            id TEXT PRIMARY KEY,
            usuarioId TEXT NOT NULL,
            tipo TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            resolvido INTEGER DEFAULT 0,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    return db;
}