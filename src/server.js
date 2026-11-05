// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Rota de Teste de Saúde da API
app.get('/api/status', (req, res) => {
    res.json({ status: 'API AtivIdade operacional' });
});

// Rota de Login por Telemóvel e PIN
app.post('/api/auth/login', async (req, res) => {
    const { telemovel, pin } = req.body;

    if (!telemovel || !pin) {
        return res.status(400).json({ erro: 'Telemóvel e PIN são obrigatórios.' });
    }

    try {
        const usuario = await prisma.user.findUnique({
            where: { telemovel }
        });

        if (!usuario) {
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }

        const pinValido = await bcrypt.compare(pin, usuario.pin);
        if (!pinValido) {
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: usuario.id, tipo: usuario.tipo, nome: usuario.nome },
            process.env.JWT_SECRET || 'chave_secreta_padrao',
            { expiresIn: '7d' }
        );

        return res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo,
                instituicao: usuario.tipo === 'gestor' ? 'Centro Sénior Viver Bem' : undefined,
                especialidade: usuario.tipo === 'profissional' ? 'Fisioterapia Geriátrica' : undefined
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ erro: 'Erro interno ao processar autenticação.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});