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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let db;

app.get('/api/status', (req, res) => res.json({ status: 'API AtivIdade operacional' }));

// ==========================================
// AUTENTICAÇÃO E CADASTRO
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { celular, pin } = req.body;
    try {
        const usuario = await db.get('SELECT * FROM User WHERE celular = ?', [celular]);
        if (!usuario || !(await bcrypt.compare(pin, usuario.pin))) {
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, tipo: usuario.tipo, nome: usuario.nome }, 
            process.env.JWT_SECRET || 'chave-secreta-atividade', 
            { expiresIn: '7d' }
        );
        
        return res.json({ 
            token, 
            usuario: { 
                id: usuario.id, 
                nome: usuario.nome, 
                celular: usuario.celular, 
                email: usuario.email || '',
                tipo: usuario.tipo, 
                especialidade: usuario.especialidade || '', 
                registroProfissional: usuario.registroProfissional || '',
                formacao: usuario.formacao || '', 
                biografia: usuario.biografia || '', 
                idade: usuario.idade,
                mobilidade: usuario.mobilidade, 
                condicoes: usuario.condicoes, 
                contatoEmergenciaNome: usuario.contatoEmergenciaNome,
                contatoEmergenciaTel: usuario.contatoEmergenciaTel
            } 
        });
    } catch (error) { 
        return res.status(500).json({ erro: error.message }); 
    }
});

app.post('/api/auth/registo', async (req, res) => {
    const { nome, idade, celular, pin, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel } = req.body;
    try {
        if (await db.get('SELECT id FROM User WHERE celular = ?', [celular])) {
            return res.status(400).json({ erro: 'Este celular já está cadastrado.' });
        }
        
        const pinHash = await bcrypt.hash(pin, 10);
        await db.run(
            `INSERT INTO User (id, nome, celular, pin, tipo, idade, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [
                crypto.randomUUID(), 
                nome, 
                celular, 
                pinHash, 
                'idoso', 
                idade ? Number(idade) : null, 
                mobilidade || 'Caminho sem ajuda', 
                Array.isArray(condicoes) ? condicoes.join(', ') : (condicoes || ''), 
                contatoEmergenciaNome || '', 
                contatoEmergenciaTel || ''
            ]
        );
        return res.status(201).json({ sucesso: true });
    } catch (error) { 
        return res.status(500).json({ erro: error.message }); 
    }
});

// ==========================================
// USUÁRIOS E PERFIL
// ==========================================
app.put('/api/usuarios/:id', async (req, res) => {
    const { 
        nome, celular, email, especialidade, registroProfissional, 
        formacao, biografia, pin, idade, condicoes, 
        contatoEmergenciaNome, contatoEmergenciaTel 
    } = req.body;

    try {
        let pinHash = undefined;
        if (pin && pin.trim().length === 4) {
            pinHash = await bcrypt.hash(pin.trim(), 10);
        }

        await db.run(
            `UPDATE User SET 
                nome = COALESCE(?, nome), 
                celular = COALESCE(?, celular), 
                email = COALESCE(?, email), 
                especialidade = COALESCE(?, especialidade), 
                registroProfissional = COALESCE(?, registroProfissional), 
                formacao = COALESCE(?, formacao), 
                biografia = COALESCE(?, biografia), 
                pin = COALESCE(?, pin), 
                idade = COALESCE(?, idade), 
                condicoes = COALESCE(?, condicoes), 
                contatoEmergenciaNome = COALESCE(?, contatoEmergenciaNome), 
                contatoEmergenciaTel = COALESCE(?, contatoEmergenciaTel) 
             WHERE id = ?`,
            [
                nome || null, celular || null, email || null, especialidade || null, 
                registroProfissional || null, formacao || null, biografia || null, 
                pinHash || null, idade ? Number(idade) : null, condicoes || null, 
                contatoEmergenciaNome || null, contatoEmergenciaTel || null, req.params.id
            ]
        );

        const usuarioAtualizado = await db.get(
            `SELECT id, nome, celular, email, tipo, especialidade, registroProfissional, formacao, biografia, idade, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel 
             FROM User WHERE id = ?`, 
            [req.params.id]
        );

        return res.json({ sucesso: true, usuario: usuarioAtualizado });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// PROFISSIONAIS (EQUIPE)
// ==========================================
app.get('/api/profissionais', async (req, res) => { 
    try { 
        const profs = await db.all(
            `SELECT id, nome, celular, email, especialidade, registroProfissional, formacao, biografia, dataCriacao 
             FROM User WHERE tipo = "profissional" ORDER BY nome ASC`
        );
        return res.json(profs); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/profissionais', async (req, res) => {
    const { nome, celular, pin, especialidade, registroProfissional, formacao, biografia, email } = req.body;
    try {
        if (await db.get('SELECT id FROM User WHERE celular = ?', [celular])) {
            return res.status(400).json({ erro: 'Celular já cadastrado.' });
        }
        
        await db.run(
            `INSERT INTO User (id, nome, celular, email, pin, tipo, especialidade, registroProfissional, formacao, biografia) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [
                crypto.randomUUID(), nome, celular, email || '', await bcrypt.hash(pin, 10), 
                'profissional', especialidade, registroProfissional || '', formacao || '', biografia || ''
            ]
        );
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/profissionais/:id', async (req, res) => { 
    try { 
        await db.run('DELETE FROM User WHERE id = ? AND tipo = "profissional"', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// TURMAS E ALUNOS
// ==========================================
app.get('/api/turmas', async (req, res) => {
    try {
        const turmas = await db.all('SELECT * FROM Turma ORDER BY dataCriacao ASC');
        const alunos = await db.all(
            `SELECT u.id, u.nome, u.celular, u.idade, u.mobilidade, u.condicoes, ta.turmaId 
             FROM User u JOIN TurmaAluno ta ON u.id = ta.usuarioId WHERE u.tipo = "idoso"`
        );
        return res.json(turmas.map(t => ({ ...t, alunos: alunos.filter(a => a.turmaId === t.id) })));
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/turmas', async (req, res) => { 
    try { 
        await db.run(
            `INSERT INTO Turma (id, nome, horario, dias, cor, profissionalId) VALUES (?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), req.body.nome, req.body.horario, req.body.dias, req.body.cor || '#059669', req.body.profissionalId || null]
        ); 
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/turmas/:id', async (req, res) => {
    try { 
        await db.run('DELETE FROM Turma WHERE id = ?', [req.params.id]); 
        await db.run('DELETE FROM TurmaAluno WHERE turmaId = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/turmas/:turmaId/alunos', async (req, res) => { 
    try { 
        await db.run('INSERT OR IGNORE INTO TurmaAluno (usuarioId, turmaId) VALUES (?, ?)', [req.body.usuarioId, req.params.turmaId]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/turmas/:turmaId/alunos/:usuarioId', async (req, res) => { 
    try { 
        await db.run('DELETE FROM TurmaAluno WHERE usuarioId = ? AND turmaId = ?', [req.params.usuarioId, req.params.turmaId]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.get('/api/utentes', async (req, res) => {
    try {
        const utentes = await db.all(
            `SELECT id, nome, celular, idade, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel 
             FROM User WHERE tipo = "idoso" ORDER BY nome ASC`
        );
        const matriculas = await db.all('SELECT usuarioId, turmaId FROM TurmaAluno');
        return res.json(utentes.map(u => ({ ...u, turmasIds: matriculas.filter(m => m.usuarioId === u.id).map(m => m.turmaId) })));
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// ACERVO E PRESCRIÇÕES
// ==========================================
app.get('/api/acervo/:profissionalId', async (req, res) => { 
    try { 
        const itens = await db.all(`SELECT * FROM Acervo WHERE profissionalId = ? ORDER BY grupo ASC, titulo ASC`, [req.params.profissionalId]);
        return res.json(itens); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/acervo', async (req, res) => {
    const { profissionalId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, cor } = req.body;
    try {
        await db.run(
            `INSERT INTO Acervo (id, profissionalId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, cor) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), profissionalId, titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo || 'Modelo', cor || '#059669']
        );
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.put('/api/acervo/:id', async (req, res) => {
    const { titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, cor } = req.body;
    try {
        await db.run(
            `UPDATE Acervo SET titulo=?, tipo=?, duracaoMinutos=?, series=?, repeticoes=?, carga=?, meta=?, focoMuscular=?, gifUrl=?, grupo=?, cor=? WHERE id=?`, 
            [titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo, cor, req.params.id]
        );
        return res.json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/acervo/:id', async (req, res) => { 
    try { 
        await db.run('DELETE FROM Acervo WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/prescricoes', async (req, res) => {
    const { usuarioId, turmaId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor } = req.body;
    try {
        let destinatarios = [];
        if (turmaId) destinatarios = (await db.all('SELECT usuarioId FROM TurmaAluno WHERE turmaId = ?', [turmaId])).map(a => a.usuarioId);
        else if (usuarioId) destinatarios = [usuarioId];
        
        if (destinatarios.length === 0) return res.status(400).json({ erro: 'Nenhum paciente selecionado.' });
        
        for (const id of destinatarios) {
            await db.run(
                `INSERT INTO Prescricao (id, usuarioId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [crypto.randomUUID(), id, titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo || 'Treino', diasDaSemana || '', cor || '#059669']
            );
        }
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/prescricoes/lote', async (req, res) => {
    const { usuarioId, turmaId, treinos, diasDaSemana } = req.body;
    try {
        let destinatarios = [];
        if (turmaId) destinatarios = (await db.all('SELECT usuarioId FROM TurmaAluno WHERE turmaId = ?', [turmaId])).map(a => a.usuarioId);
        else if (usuarioId) destinatarios = [usuarioId];
        
        if (destinatarios.length === 0) return res.status(400).json({ erro: 'Nenhum paciente selecionado.' });
        
        for (const id of destinatarios) {
            for (const treino of treinos) {
                await db.run(
                    `INSERT INTO Prescricao (id, usuarioId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [crypto.randomUUID(), id, treino.titulo, treino.tipo, treino.duracaoMinutos || null, treino.series || null, treino.repeticoes || null, treino.carga || null, treino.meta || null, treino.focoMuscular || null, treino.gifUrl || null, treino.grupo || 'Treino', diasDaSemana || '', treino.cor || '#059669']
                );
            }
        }
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.put('/api/prescricoes/:id', async (req, res) => {
    const { titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor } = req.body;
    try {
        await db.run(
            `UPDATE Prescricao SET titulo=?, tipo=?, duracaoMinutos=?, series=?, repeticoes=?, carga=?, meta=?, focoMuscular=?, gifUrl=?, grupo=?, diasDaSemana=?, cor=? WHERE id=?`, 
            [titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo, diasDaSemana, cor, req.params.id]
        );
        return res.json({ sucesso: true });
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.get('/api/prescricoes/:usuarioId', async (req, res) => { 
    try { 
        const itens = await db.all(`SELECT * FROM Prescricao WHERE usuarioId = ? ORDER BY grupo ASC, dataCriacao ASC`, [req.params.usuarioId]);
        return res.json(itens); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/prescricoes/:id', async (req, res) => { 
    try { 
        await db.run('DELETE FROM Prescricao WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// ATIVIDADES, HISTÓRICO E ALERTAS
// ==========================================
app.get('/api/atividades/:usuarioId', async (req, res) => { 
    try { 
        const historico = await db.all(`SELECT * FROM Atividade WHERE usuarioId = ? ORDER BY dataCriacao DESC`, [req.params.usuarioId]);
        return res.json(historico); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/atividades', async (req, res) => { 
    try { 
        await db.run(
            `INSERT INTO Atividade (id, usuarioId, titulo, tipo, duracaoSegundos, series, repeticoes, carga, meta, focoMuscular, gifUrl, feedback, grupo, cor) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), req.body.usuarioId, req.body.titulo, req.body.tipo || 'tempo', req.body.duracaoSegundos || 0, req.body.series || null, req.body.repeticoes || null, req.body.carga || null, req.body.meta || null, req.body.focoMuscular || null, req.body.gifUrl || null, req.body.feedback, req.body.grupo || 'Geral', req.body.cor || '#059669']
        ); 
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/alertas', async (req, res) => {
    try { 
        await db.run(`INSERT INTO Alerta (id, usuarioId, tipo, mensagem, resolvido) VALUES (?, ?, ?, ?, 0)`, [crypto.randomUUID(), req.body.usuarioId, req.body.tipo, req.body.mensagem]); 
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.get('/api/alertas/pendentes', async (req, res) => { 
    try { 
        const alertas = await db.all(
            `SELECT a.*, u.nome as utenteNome, u.celular as utenteTel 
             FROM Alerta a JOIN User u ON a.usuarioId = u.id 
             WHERE a.resolvido = 0 ORDER BY a.dataCriacao DESC`
        );
        return res.json(alertas); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.put('/api/alertas/:id/resolver', async (req, res) => { 
    try { 
        await db.run('UPDATE Alerta SET resolvido = 1 WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

app.get('/api/estatisticas', async (req, res) => { 
    try { 
        const idosos = await db.get('SELECT COUNT(*) as total FROM User WHERE tipo = "idoso"');
        const profissionais = await db.get('SELECT COUNT(*) as total FROM User WHERE tipo = "profissional"');
        const turmas = await db.get('SELECT COUNT(*) as total FROM Turma');
        const treinos = await db.get('SELECT COUNT(*) as total FROM Atividade');
        const alertas = await db.get('SELECT COUNT(*) as total FROM Alerta');

        return res.json({ 
            idosos: idosos.total, 
            profissionais: profissionais.total, 
            turmas: turmas.total, 
            treinos: treinos.total, 
            alertas: alertas.total 
        }); 
    } catch (e) { 
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR E DB
// ==========================================
const PORT = process.env.PORT || 3001;

iniciarBanco().then(async (dbInst) => {
    db = dbInst;
    await db.run(`CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY, 
        nome TEXT, 
        celular TEXT UNIQUE, 
        email TEXT, 
        pin TEXT, 
        tipo TEXT, 
        especialidade TEXT, 
        registroProfissional TEXT, 
        formacao TEXT, 
        biografia TEXT, 
        idade INTEGER, 
        mobilidade TEXT, 
        condicoes TEXT, 
        contatoEmergenciaNome TEXT, 
        contatoEmergenciaTel TEXT, 
        dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.run(`CREATE TABLE IF NOT EXISTS Turma (id TEXT PRIMARY KEY, nome TEXT, horario TEXT, dias TEXT, cor TEXT, profissionalId TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE IF NOT EXISTS TurmaAluno (usuarioId TEXT, turmaId TEXT, PRIMARY KEY (usuarioId, turmaId))`);
    await db.run(`CREATE TABLE IF NOT EXISTS Prescricao (id TEXT PRIMARY KEY, usuarioId TEXT, grupo TEXT, diasDaSemana TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoMinutos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE IF NOT EXISTS Atividade (id TEXT PRIMARY KEY, usuarioId TEXT, grupo TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoSegundos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, feedback TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE IF NOT EXISTS Alerta (id TEXT PRIMARY KEY, usuarioId TEXT, tipo TEXT, mensagem TEXT, resolvido INTEGER DEFAULT 0, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await db.run(`CREATE TABLE IF NOT EXISTS Acervo (id TEXT PRIMARY KEY, profissionalId TEXT, grupo TEXT, cor TEXT, titulo TEXT, tipo TEXT, duracaoMinutos INTEGER, series INTEGER, repeticoes INTEGER, carga TEXT, meta TEXT, focoMuscular TEXT, gifUrl TEXT, dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    
    console.log(`📦 Base de dados iniciada em modo: ${process.env.NODE_ENV || 'development'}`);
    app.listen(PORT, () => console.log(`🚀 API Web Service a rodar na porta ${PORT}`));
});