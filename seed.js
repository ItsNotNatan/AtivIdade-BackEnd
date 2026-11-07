// seed.js
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { iniciarBanco } from './src/db.js'; 

async function popularBanco() {
    const db = await iniciarBanco();

    console.log("Limpando usuários antigos...");
    await db.run("DELETE FROM User");

    const pin1 = await bcrypt.hash('1111', 10);
    const pin2 = await bcrypt.hash('2222', 10);
    const pin3 = await bcrypt.hash('3333', 10);

    console.log("Criando Idoso (Natan)...");
    await db.run(`INSERT INTO User (id, nome, telemovel, pin, tipo, idade, mobilidade, condicoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Natan Silva', '11999991111', pin1, 'idoso', 72, 'Caminho sem ajuda', 'Pressão Alta, Dor nos Joelhos']);

    console.log("Criando Fisioterapeuta (Dra. Camila)...");
    await db.run(`INSERT INTO User (id, nome, telemovel, pin, tipo) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Dra. Camila', '11999992222', pin2, 'profissional']);

    console.log("Criando Gestor...");
    await db.run(`INSERT INTO User (id, nome, telemovel, pin, tipo) VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), 'Gestor Carlos', '11999993333', pin3, 'gestor']);

    console.log("✅ Usuários de teste criados com sucesso!");
}

popularBanco();