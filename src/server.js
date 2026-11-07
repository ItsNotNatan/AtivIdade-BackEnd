// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { iniciarBanco } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db;

app.get('/api/status', (req, res) => res.json({ status: 'API AtivIdade operacional' }));

app.post('/api/auth/login', async (req, res) => {
    const { telemovel, pin } = req.body;
    if (!telemovel || !pin) return res.status(400).json({ erro: 'Obrigatório celular e PIN.' });
    try {
        const usuario = await db.get('SELECT * FROM User WHERE telemovel = ?', [telemovel]);
        if (!usuario || !(await bcrypt.compare(pin, usuario.pin))) return res.status(401).json({ erro: 'Credenciais inválidas.' });
        const token = jwt.sign({ id: usuario.id, tipo: usuario.tipo, nome: usuario.nome }, process.env.JWT_SECRET || 'chave', { expiresIn: '7d' });
        return res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo, instituicao: usuario.tipo === 'gestor' ? 'Centro Sénior' : undefined, especialidade: usuario.tipo === 'profissional' ? 'Fisioterapia' : undefined } });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.post('/api/auth/registo', async (req, res) => {
    const { nome, idade, telemovel, pin, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel } = req.body;
    try {
        if (await db.get('SELECT id FROM User WHERE telemovel = ?', [telemovel])) return res.status(400).json({ erro: 'Celular já cadastrado.' });
        const pinHash = await bcrypt.hash(pin, 10);
        await db.run(`INSERT INTO User (id, nome, telemovel, pin, tipo, idade, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), nome, telemovel, pinHash, 'idoso', idade, mobilidade, condicoes?.join(', ') || '', contatoEmergenciaNome, contatoEmergenciaTel]);
        return res.status(201).json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

// Atualizado: Salva o tipo e detalhes do que foi feito
app.post('/api/atividades', async (req, res) => {
    const { usuarioId, titulo, tipo, duracaoSegundos, series, repeticoes, carga, meta, feedback } = req.body;
    try {
        await db.run(`INSERT INTO Atividade (id, usuarioId, titulo, tipo, duracaoSegundos, series, repeticoes, carga, meta, feedback) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), usuarioId, titulo, tipo || 'tempo', duracaoSegundos || 0, series || null, repeticoes || null, carga || null, meta || null, feedback]);
        return res.status(201).json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro ao gravar treino.' }); }
});

app.get('/api/atividades/:usuarioId', async (req, res) => {
    try { return res.json(await db.all(`SELECT * FROM Atividade WHERE usuarioId = ? ORDER BY dataCriacao DESC`, [req.params.usuarioId])); } 
    catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.post('/api/alertas', async (req, res) => {
    const { usuarioId, tipo, mensagem } = req.body;
    try {
        await db.run(`INSERT INTO Alerta (id, usuarioId, tipo, mensagem) VALUES (?, ?, ?, ?)`, [crypto.randomUUID(), usuarioId, tipo, mensagem]);
        return res.status(201).json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.get('/api/utentes', async (req, res) => {
    try { return res.json(await db.all('SELECT id, nome, telemovel, idade, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel FROM User WHERE tipo = "idoso"')); } 
    catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.get('/api/alertas/pendentes', async (req, res) => {
    try { return res.json(await db.all(`SELECT a.*, u.nome as utenteNome, u.telemovel as utenteTel FROM Alerta a JOIN User u ON a.usuarioId = u.id WHERE a.resolvido = 0 ORDER BY a.dataCriacao DESC`)); } 
    catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.put('/api/alertas/:id/resolver', async (req, res) => {
    try {
        await db.run('UPDATE Alerta SET resolvido = 1 WHERE id = ?', [req.params.id]);
        return res.json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.get('/api/estatisticas', async (req, res) => {
    try {
        const idosos = await db.get('SELECT COUNT(*) as total FROM User WHERE tipo = "idoso"');
        const treinos = await db.get('SELECT COUNT(*) as total FROM Atividade');
        const alertas = await db.get('SELECT COUNT(*) as total FROM Alerta');
        return res.json({ idosos: idosos.total, treinos: treinos.total, alertas: alertas.total });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

// Atualizado: Salva todos os parâmetros do objeto de prescrição
app.post('/api/prescricoes', async (req, res) => {
    const { usuarioId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta } = req.body;
    try {
        await db.run(`INSERT INTO Prescricao (id, usuarioId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), usuarioId, titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null]);
        return res.status(201).json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.get('/api/prescricoes/:usuarioId', async (req, res) => {
    try { return res.json(await db.all(`SELECT * FROM Prescricao WHERE usuarioId = ? ORDER BY dataCriacao ASC`, [req.params.usuarioId])); } 
    catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

app.delete('/api/prescricoes/:id', async (req, res) => {
    try {
        await db.run(`DELETE FROM Prescricao WHERE id = ?`, [req.params.id]);
        return res.json({ sucesso: true });
    } catch (error) { return res.status(500).json({ erro: 'Erro interno.' }); }
});

const PORT = process.env.PORT || 3001;

iniciarBanco().then(async (bancoDados) => {
    db = bancoDados;
    
    // Tabela atualizada com a nova lógica Orientada a Objetos
    await db.run(`
        CREATE TABLE IF NOT EXISTS Prescricao (
            id TEXT PRIMARY KEY,
            usuarioId TEXT,
            titulo TEXT,
            tipo TEXT, 
            duracaoMinutos INTEGER,
            series INTEGER,
            repeticoes INTEGER,
            carga TEXT,
            meta TEXT,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.run(`
        CREATE TABLE IF NOT EXISTS Atividade (
            id TEXT PRIMARY KEY,
            usuarioId TEXT,
            titulo TEXT,
            tipo TEXT,
            duracaoSegundos INTEGER,
            series INTEGER,
            repeticoes INTEGER,
            carga TEXT,
            meta TEXT,
            feedback TEXT,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('📦 Banco de dados pronto (Com Lógica Dinâmica de Treinos)!');
    app.listen(PORT, () => console.log(`🚀 Backend rodando na porta ${PORT}`));
});