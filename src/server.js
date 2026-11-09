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

// Função auxiliar para não imprimir imagens gigantes em Base64 no terminal
const logLimpo = (body) => {
    if (!body) return '{}';
    const b = { ...body };
    if (b.fotoPerfil) b.fotoPerfil = '[IMAGEM_BASE64_OCULTA]';
    if (b.gifUrl) b.gifUrl = '[GIF/VIDEO_BASE64_OCULTO]';
    return JSON.stringify(b);
};

app.get('/api/status', (req, res) => {
    console.log('[STATUS] Verificação de saúde da API recebida.');
    res.json({ status: 'API AtivIdade operacional' });
});

// ==========================================
// AUTENTICAÇÃO E CADASTRO
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { celular, pin } = req.body;
    console.log(`\n--- [LOGIN] Tentativa de acesso ---`);
    console.log(`Dados recebidos -> Celular: "${celular}", PIN digitado: "${pin}"`);
    
    try {
        const usuario = await db.get('SELECT * FROM "User" WHERE celular = ?', [celular]);
        
        if (!usuario) {
            console.log(`[LOGIN - ERRO] Nenhum utilizador encontrado com o celular "${celular}".`);
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }
        
        console.log(`[LOGIN] Utilizador encontrado: ${usuario.nome} (ID: ${usuario.id}). A verificar PIN...`);
        const pinCorreto = await bcrypt.compare(pin, usuario.pin);
        
        if (!pinCorreto) {
            console.log(`[LOGIN - ERRO] PIN incorreto para o utilizador ${usuario.nome}.`);
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }
        
        console.log(`[LOGIN - SUCESSO] Utilizador ${usuario.nome} autenticado com sucesso! Gerando token...`);
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
                fotoPerfil: usuario.fotoPerfil || '',
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
        console.error(`[LOGIN - EXCEÇÃO] Erro interno:`, error.message);
        return res.status(500).json({ erro: error.message }); 
    }
});

app.post('/api/auth/registo', async (req, res) => {
    console.log(`\n--- [REGISTO] Novo Paciente ---`);
    console.log(`Payload:`, logLimpo(req.body));
    const { nome, idade, celular, pin, mobilidade, condicoes, contatoEmergenciaNome, contatoEmergenciaTel, fotoPerfil } = req.body;
    
    try {
        const existe = await db.get('SELECT id FROM "User" WHERE celular = ?', [celular]);
        if (existe) {
            console.log(`[REGISTO - ERRO] Celular ${celular} já está em uso.`);
            return res.status(400).json({ erro: 'Este celular já está cadastrado.' });
        }
        
        const pinHash = await bcrypt.hash(pin, 10);
        const novoId = crypto.randomUUID();
        
        await db.run(
            `INSERT INTO "User" (id, nome, celular, pin, tipo, idade, mobilidade, condicoes, "contatoEmergenciaNome", "contatoEmergenciaTel", "fotoPerfil") 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [
                novoId, nome, celular, pinHash, 'idoso', 
                idade ? Number(idade) : null, mobilidade || 'Caminho sem ajuda', 
                Array.isArray(condicoes) ? condicoes.join(', ') : (condicoes || ''), 
                contatoEmergenciaNome || '', contatoEmergenciaTel || '', fotoPerfil || null
            ]
        );
        console.log(`[REGISTO - SUCESSO] Paciente ${nome} criado (ID: ${novoId}).`);
        return res.status(201).json({ sucesso: true });
    } catch (error) { 
        console.error(`[REGISTO - EXCEÇÃO]`, error.message);
        return res.status(500).json({ erro: error.message }); 
    }
});

// ==========================================
// USUÁRIOS E PERFIL
// ==========================================
app.put('/api/usuarios/:id', async (req, res) => {
    console.log(`\n--- [PERFIL] Atualizar Utilizador (ID: ${req.params.id}) ---`);
    console.log(`Payload:`, logLimpo(req.body));
    const { 
        nome, celular, email, especialidade, registroProfissional, 
        formacao, biografia, pin, idade, condicoes, 
        contatoEmergenciaNome, contatoEmergenciaTel, fotoPerfil 
    } = req.body;

    try {
        let pinHash = undefined;
        if (pin && pin.trim().length === 4) {
            console.log(`[PERFIL] Utilizador pediu alteração de PIN.`);
            pinHash = await bcrypt.hash(pin.trim(), 10);
        }

        await db.run(
            `UPDATE "User" SET 
                nome = COALESCE(?, nome), celular = COALESCE(?, celular), email = COALESCE(?, email), 
                especialidade = COALESCE(?, especialidade), "registroProfissional" = COALESCE(?, "registroProfissional"), 
                formacao = COALESCE(?, formacao), biografia = COALESCE(?, biografia), pin = COALESCE(?, pin), 
                idade = COALESCE(?, idade), condicoes = COALESCE(?, condicoes), 
                "contatoEmergenciaNome" = COALESCE(?, "contatoEmergenciaNome"), 
                "contatoEmergenciaTel" = COALESCE(?, "contatoEmergenciaTel"), "fotoPerfil" = COALESCE(?, "fotoPerfil")
             WHERE id = ?`,
            [
                nome || null, celular || null, email || null, especialidade || null, registroProfissional || null, 
                formacao || null, biografia || null, pinHash || null, idade ? Number(idade) : null, condicoes || null, 
                contatoEmergenciaNome || null, contatoEmergenciaTel || null, fotoPerfil || null, req.params.id
            ]
        );

        const usuarioAtualizado = await db.get(`SELECT * FROM "User" WHERE id = ?`, [req.params.id]);
        console.log(`[PERFIL - SUCESSO] Perfil atualizado.`);
        return res.json({ sucesso: true, usuario: usuarioAtualizado });
    } catch (e) { 
        console.error(`[PERFIL - ERRO]`, e.message);
        return res.status(500).json({ erro: e.message }); 
    }
});

// ==========================================
// PROFISSIONAIS E EQUIPA
// ==========================================
app.get('/api/profissionais', async (req, res) => { 
    console.log(`[EQUIPA] A listar profissionais...`);
    try { 
        const profs = await db.all(`SELECT id, nome, celular, email, "fotoPerfil", especialidade, "registroProfissional", formacao, biografia, "dataCriacao" FROM "User" WHERE tipo = 'profissional' ORDER BY nome ASC`);
        return res.json(profs); 
    } catch (e) { 
        console.error(`[EQUIPA - ERRO]`, e.message);
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/profissionais', async (req, res) => {
    console.log(`\n--- [EQUIPA] Registar Novo Profissional ---`);
    console.log(`Payload:`, logLimpo(req.body));
    const { nome, celular, pin, especialidade, registroProfissional, formacao, biografia, email, fotoPerfil } = req.body;
    try {
        const existe = await db.get('SELECT id FROM "User" WHERE celular = ?', [celular]);
        if (existe) return res.status(400).json({ erro: 'Celular já cadastrado.' });
        
        await db.run(
            `INSERT INTO "User" (id, nome, celular, email, pin, tipo, especialidade, "registroProfissional", formacao, biografia, "fotoPerfil") 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), nome, celular, email || '', await bcrypt.hash(pin, 10), 'profissional', especialidade, registroProfissional || '', formacao || '', biografia || '', fotoPerfil || null]
        );
        console.log(`[EQUIPA - SUCESSO] Profissional registado.`);
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        console.error(`[EQUIPA - ERRO]`, e.message);
        return res.status(500).json({ erro: e.message }); 
    }
});

app.delete('/api/profissionais/:id', async (req, res) => { 
    console.log(`[EQUIPA] Remover profissional (ID: ${req.params.id})`);
    try { 
        await db.run(`DELETE FROM "User" WHERE id = ? AND tipo = 'profissional'`, [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

// ==========================================
// TURMAS E ALUNOS
// ==========================================
app.get('/api/turmas', async (req, res) => {
    console.log(`[TURMAS] Listar turmas e os seus alunos...`);
    try {
        const turmas = await db.all('SELECT * FROM "Turma" ORDER BY "dataCriacao" ASC');
        const alunos = await db.all(`SELECT u.id, u.nome, u.celular, u."fotoPerfil", u.idade, u.mobilidade, u.condicoes, ta."turmaId" FROM "User" u JOIN "TurmaAluno" ta ON u.id = ta."usuarioId" WHERE u.tipo = 'idoso'`);
        return res.json(turmas.map(t => ({ ...t, alunos: alunos.filter(a => a.turmaId === t.id) })));
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.post('/api/turmas', async (req, res) => { 
    console.log(`\n--- [TURMAS] Criar Nova Turma ---`);
    console.log(`Payload:`, req.body);
    try { 
        await db.run(
            `INSERT INTO "Turma" (id, nome, horario, dias, cor, "profissionalId") VALUES (?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), req.body.nome, req.body.horario, req.body.dias, req.body.cor || '#059669', req.body.profissionalId || null]
        ); 
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.delete('/api/turmas/:id', async (req, res) => {
    console.log(`[TURMAS] Apagar turma (ID: ${req.params.id})`);
    try { 
        await db.run('DELETE FROM "Turma" WHERE id = ?', [req.params.id]); 
        await db.run('DELETE FROM "TurmaAluno" WHERE "turmaId" = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.post('/api/turmas/:turmaId/alunos', async (req, res) => { 
    console.log(`[TURMAS] Adicionar Aluno ${req.body.usuarioId} à turma ${req.params.turmaId}`);
    try { 
        await db.run('INSERT INTO "TurmaAluno" ("usuarioId", "turmaId") VALUES (?, ?) ON CONFLICT DO NOTHING', [req.body.usuarioId, req.params.turmaId]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.delete('/api/turmas/:turmaId/alunos/:usuarioId', async (req, res) => { 
    console.log(`[TURMAS] Remover Aluno ${req.params.usuarioId} da turma ${req.params.turmaId}`);
    try { 
        await db.run('DELETE FROM "TurmaAluno" WHERE "usuarioId" = ? AND "turmaId" = ?', [req.params.usuarioId, req.params.turmaId]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.get('/api/utentes', async (req, res) => {
    console.log(`[UTENTES] Listar todos os idosos do sistema...`);
    try {
        const utentes = await db.all(`SELECT id, nome, celular, "fotoPerfil", idade, mobilidade, condicoes, "contatoEmergenciaNome", "contatoEmergenciaTel" FROM "User" WHERE tipo = 'idoso' ORDER BY nome ASC`);
        const matriculas = await db.all('SELECT "usuarioId", "turmaId" FROM "TurmaAluno"');
        return res.json(utentes.map(u => ({ ...u, turmasIds: matriculas.filter(m => m.usuarioId === u.id).map(m => m.turmaId) })));
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

// ==========================================
// ACERVO E PRESCRIÇÕES
// ==========================================
app.get('/api/acervo/:profissionalId', async (req, res) => { 
    console.log(`[ACERVO] Listar acervo do profissional ${req.params.profissionalId}`);
    try { 
        const itens = await db.all(`SELECT * FROM "Acervo" WHERE "profissionalId" = ? ORDER BY grupo ASC, titulo ASC`, [req.params.profissionalId]);
        return res.json(itens); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.post('/api/acervo', async (req, res) => {
    console.log(`\n--- [ACERVO] Criar novo modelo de exercício ---`);
    console.log(`Payload:`, logLimpo(req.body));
    const { profissionalId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, cor } = req.body;
    try {
        await db.run(
            `INSERT INTO "Acervo" (id, "profissionalId", titulo, tipo, "duracaoMinutos", series, repeticoes, carga, meta, "focoMuscular", "gifUrl", grupo, cor) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), profissionalId, titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo || 'Modelo', cor || '#059669']
        );
        return res.status(201).json({ sucesso: true });
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.put('/api/acervo/:id', async (req, res) => {
    console.log(`[ACERVO] Editar modelo (ID: ${req.params.id})`);
    const { titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, cor } = req.body;
    try {
        await db.run(
            `UPDATE "Acervo" SET titulo=?, tipo=?, "duracaoMinutos"=?, series=?, repeticoes=?, carga=?, meta=?, "focoMuscular"=?, "gifUrl"=?, grupo=?, cor=? WHERE id=?`, 
            [titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo, cor, req.params.id]
        );
        return res.json({ sucesso: true });
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.delete('/api/acervo/:id', async (req, res) => { 
    console.log(`[ACERVO] Apagar modelo (ID: ${req.params.id})`);
    try { 
        await db.run('DELETE FROM "Acervo" WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.post('/api/prescricoes', async (req, res) => {
    console.log(`\n--- [PRESCRIÇÕES] Nova Prescrição Individual/Turma ---`);
    console.log(`Payload:`, logLimpo(req.body));
    const { usuarioId, turmaId, titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor } = req.body;
    try {
        let destinatarios = [];
        if (turmaId) destinatarios = (await db.all('SELECT "usuarioId" FROM "TurmaAluno" WHERE "turmaId" = ?', [turmaId])).map(a => a.usuarioId);
        else if (usuarioId) destinatarios = [usuarioId];
        
        if (destinatarios.length === 0) return res.status(400).json({ erro: 'Nenhum paciente selecionado.' });
        
        console.log(`[PRESCRIÇÕES] A gravar para ${destinatarios.length} utente(s)...`);
        for (const id of destinatarios) {
            await db.run(
                `INSERT INTO "Prescricao" (id, "usuarioId", titulo, tipo, "duracaoMinutos", series, repeticoes, carga, meta, "focoMuscular", "gifUrl", grupo, "diasDaSemana", cor) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [crypto.randomUUID(), id, titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo || 'Treino', diasDaSemana || '', cor || '#059669']
            );
        }
        console.log(`[PRESCRIÇÕES - SUCESSO] Gravado.`);
        return res.status(201).json({ sucesso: true });
    } catch (e) { 
        console.error(`[PRESCRIÇÕES - ERRO]`, e.message);
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/prescricoes/lote', async (req, res) => {
    console.log(`\n--- [PRESCRIÇÕES] Prescrição em LOTE (Vários exercícios) ---`);
    const { usuarioId, turmaId, treinos, diasDaSemana } = req.body;
    try {
        let destinatarios = [];
        if (turmaId) destinatarios = (await db.all('SELECT "usuarioId" FROM "TurmaAluno" WHERE "turmaId" = ?', [turmaId])).map(a => a.usuarioId);
        else if (usuarioId) destinatarios = [usuarioId];
        
        if (destinatarios.length === 0) return res.status(400).json({ erro: 'Nenhum paciente selecionado.' });
        
        console.log(`[PRESCRIÇÕES LOTE] Inserindo ${treinos.length} exercícios para ${destinatarios.length} utente(s)...`);
        for (const id of destinatarios) {
            for (const treino of treinos) {
                await db.run(
                    `INSERT INTO "Prescricao" (id, "usuarioId", titulo, tipo, "duracaoMinutos", series, repeticoes, carga, meta, "focoMuscular", "gifUrl", grupo, "diasDaSemana", cor) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [crypto.randomUUID(), id, treino.titulo, treino.tipo, treino.duracaoMinutos || null, treino.series || null, treino.repeticoes || null, treino.carga || null, treino.meta || null, treino.focoMuscular || null, treino.gifUrl || null, treino.grupo || 'Treino', diasDaSemana || '', treino.cor || '#059669']
                );
            }
        }
        console.log(`[PRESCRIÇÕES LOTE - SUCESSO]`);
        return res.status(201).json({ sucesso: true });
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.put('/api/prescricoes/:id', async (req, res) => {
    console.log(`[PRESCRIÇÕES] Atualizar prescrição (ID: ${req.params.id})`);
    const { titulo, tipo, duracaoMinutos, series, repeticoes, carga, meta, focoMuscular, gifUrl, grupo, diasDaSemana, cor } = req.body;
    try {
        await db.run(
            `UPDATE "Prescricao" SET titulo=?, tipo=?, "duracaoMinutos"=?, series=?, repeticoes=?, carga=?, meta=?, "focoMuscular"=?, "gifUrl"=?, grupo=?, "diasDaSemana"=?, cor=? WHERE id=?`, 
            [titulo, tipo, duracaoMinutos || null, series || null, repeticoes || null, carga || null, meta || null, focoMuscular || null, gifUrl || null, grupo, diasDaSemana, cor, req.params.id]
        );
        return res.json({ sucesso: true });
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.get('/api/prescricoes/:usuarioId', async (req, res) => { 
    console.log(`[PRESCRIÇÕES] Buscar agenda do paciente (ID: ${req.params.usuarioId})`);
    try { 
        const itens = await db.all(`SELECT * FROM "Prescricao" WHERE "usuarioId" = ? ORDER BY grupo ASC, "dataCriacao" ASC`, [req.params.usuarioId]);
        return res.json(itens); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.delete('/api/prescricoes/:id', async (req, res) => { 
    console.log(`[PRESCRIÇÕES] Apagar prescrição (ID: ${req.params.id})`);
    try { 
        await db.run('DELETE FROM "Prescricao" WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

// ==========================================
// ATIVIDADES, HISTÓRICO E ALERTAS
// ==========================================
app.get('/api/atividades/:usuarioId', async (req, res) => { 
    console.log(`[ATIVIDADES] Buscar histórico concluído do paciente (ID: ${req.params.usuarioId})`);
    try { 
        const historico = await db.all(`SELECT * FROM "Atividade" WHERE "usuarioId" = ? ORDER BY "dataCriacao" DESC`, [req.params.usuarioId]);
        return res.json(historico); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.post('/api/atividades', async (req, res) => { 
    console.log(`\n--- [ATIVIDADES] Treino Concluído pelo Idoso! ---`);
    console.log(`Payload:`, logLimpo(req.body));
    try { 
        await db.run(
            `INSERT INTO "Atividade" (id, "usuarioId", titulo, tipo, "duracaoSegundos", series, repeticoes, carga, meta, "focoMuscular", "gifUrl", feedback, grupo, cor) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [crypto.randomUUID(), req.body.usuarioId, req.body.titulo, req.body.tipo || 'tempo', req.body.duracaoSegundos || 0, req.body.series || null, req.body.repeticoes || null, req.body.carga || null, req.body.meta || null, req.body.focoMuscular || null, req.body.gifUrl || null, req.body.feedback, req.body.grupo || 'Geral', req.body.cor || '#059669']
        ); 
        console.log(`[ATIVIDADES - SUCESSO] Histórico gravado.`);
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { 
        console.error(`[ATIVIDADES - ERRO]`, e.message);
        return res.status(500).json({ erro: e.message }); 
    }
});

app.post('/api/alertas', async (req, res) => {
    console.log(`\n!!! [ALERTA GERADO] !!!`);
    console.log(`Payload:`, req.body);
    try { 
        await db.run(
            `INSERT INTO "Alerta" (id, "usuarioId", tipo, mensagem, treino, grupo, resolvido) VALUES (?, ?, ?, ?, ?, ?, 0)`, 
            [crypto.randomUUID(), req.body.usuarioId, req.body.tipo, req.body.mensagem, req.body.treino || null, req.body.grupo || null]
        ); 
        return res.status(201).json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.get('/api/alertas/pendentes', async (req, res) => { 
    console.log(`[ALERTAS] Profissional a consultar alertas pendentes...`);
    try { 
        const alertas = await db.all(
            `SELECT a.*, u.nome as "utenteNome", u.celular as "utenteTel" 
             FROM "Alerta" a JOIN "User" u ON a."usuarioId" = u.id 
             WHERE a.resolvido = 0 ORDER BY a."dataCriacao" DESC`
        );
        return res.json(alertas); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.put('/api/alertas/:id/resolver', async (req, res) => { 
    console.log(`[ALERTAS] Alerta resolvido pelo profissional (ID: ${req.params.id})`);
    try { 
        await db.run('UPDATE "Alerta" SET resolvido = 1 WHERE id = ?', [req.params.id]); 
        return res.json({ sucesso: true }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

app.get('/api/estatisticas', async (req, res) => { 
    console.log(`[ESTATÍSTICAS] Dashboard Gestor carregado.`);
    try { 
        const idosos = await db.get(`SELECT COUNT(*) as total FROM "User" WHERE tipo = 'idoso'`);
        const profissionais = await db.get(`SELECT COUNT(*) as total FROM "User" WHERE tipo = 'profissional'`);
        const turmas = await db.get('SELECT COUNT(*) as total FROM "Turma"');
        const treinos = await db.get('SELECT COUNT(*) as total FROM "Atividade"');
        const alertas = await db.get('SELECT COUNT(*) as total FROM "Alerta"');

        return res.json({ 
            idosos: idosos.total, 
            profissionais: profissionais.total, 
            turmas: turmas.total, 
            treinos: treinos.total, 
            alertas: alertas.total 
        }); 
    } catch (e) { return res.status(500).json({ erro: e.message }); }
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR E DB
// ==========================================
const PORT = process.env.PORT || 3001;

iniciarBanco().then(async (dbInst) => {
    db = dbInst;
    console.log(`\n=================================================`);
    console.log(`📦 Base de dados conectada com sucesso em modo: ${process.env.NODE_ENV || 'development'}`);
    app.listen(PORT, () => console.log(`🚀 API Web Service a rodar na porta ${PORT}`));
    console.log(`=================================================\n`);
}).catch(err => {
    console.error('Erro ao conectar ao banco de dados:', err);
});