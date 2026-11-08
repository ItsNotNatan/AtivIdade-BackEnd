// seed.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { iniciarBanco } from './src/db.js'; 

async function popularBanco() {
    const db = await iniciarBanco();
    console.log("Recriando sistema para suportar Celular e Registro...");
    
    await db.run("DROP TABLE IF EXISTS User");
    await db.run("DROP TABLE IF EXISTS Turma");
    await db.run("DROP TABLE IF EXISTS TurmaAluno");
    await db.run("DROP TABLE IF EXISTS Prescricao");
    await db.run("DROP TABLE IF EXISTS Atividade");
    await db.run("DROP TABLE IF EXISTS Alerta");
    await db.run("DROP TABLE IF EXISTS Acervo");

    await db.run(`CREATE TABLE User (id TEXT PRIMARY KEY, nome TEXT, celular TEXT UNIQUE, email TEXT, pin TEXT, tipo TEXT, especialidade TEXT, registroProfissional TEXT, formacao TEXT, biografia TEXT, idade INTEGER, mobilidade TEXT, condicoes TEXT, contatoEmergenciaNome TEXT, contatoEmergenciaTel TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE Turma (id TEXT PRIMARY KEY, nome TEXT, horario TEXT, dias TEXT, cor TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE TurmaAluno (usuarioId TEXT, turmaId TEXT, PRIMARY KEY (usuarioId, turmaId))`);
    await db.run(`CREATE TABLE Prescricao (id TEXT PRIMARY KEY, usuarioId TEXT, grupo TEXT, diasDaSemana TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoMinutos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE Atividade (id TEXT PRIMARY KEY, usuarioId TEXT, grupo TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoSegundos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, feedback TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE Alerta (id TEXT PRIMARY KEY, usuarioId TEXT, tipo TEXT, mensagem TEXT, resolvido INTEGER DEFAULT 0, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE Acervo (id TEXT PRIMARY KEY, profissionalId TEXT, grupo TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoMinutos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    const pin1 = await bcrypt.hash('1111', 10);
    const pin2 = await bcrypt.hash('2222', 10);
    
    await db.run(`INSERT INTO User (id, nome, celular, pin, tipo, especialidade, registroProfissional, biografia) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [crypto.randomUUID(), 'Dra. Camila', '(11) 99999-2222', pin2, 'profissional', 'Fisioterapia Geriátrica', 'CREFITO 12345-F', 'Especialista em reabilitação motora e prevenção de quedas para a terceira idade há 8 anos.']);
    
    await db.run(`INSERT INTO User (id, nome, celular, pin, tipo) VALUES (?, ?, ?, ?, ?)`, [crypto.randomUUID(), 'Gestor Carlos', '(11) 99999-3333', pin2, 'gestor']);

    const idT1 = 'turma-manha';
    await db.run(`INSERT INTO Turma (id, nome, horario, dias, cor) VALUES (?, ?, ?, ?, ?)`, [idT1, 'Turma Manhã Ativa', '08:30 - 09:30', 'Seg, Qua', '#059669']);

    const idNatan = crypto.randomUUID();
    await db.run(`INSERT INTO User (id, nome, celular, pin, tipo, idade, mobilidade) VALUES (?, ?, ?, ?, ?, ?, ?)`, [idNatan, 'Natan Silva', '(11) 99999-1111', pin1, 'idoso', 72, 'Caminho sem ajuda']);
    await db.run('INSERT INTO TurmaAluno (usuarioId, turmaId) VALUES (?, ?)', [idNatan, idT1]);

    console.log("✅ Sistema populado com celular e registroProfissional!");
}
popularBanco();