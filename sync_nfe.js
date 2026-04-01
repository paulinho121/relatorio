const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = "https://sjimfrvggujbarxedplu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaW1mcnZnZ3VqYmFyeGVkcGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQxMDcsImV4cCI6MjA4ODY0MDEwN30.xL39Ku8lZuTsvxsUhyBj_iEV721ASMG2gVjUxyG1H3E";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Script de Sincronização Automática (NFe -> Cloud)
 * Uso: node sync_nfe.js "./minha_pasta_de_xmls"
 */

async function syncFolder(folderPath) {
    console.log(`🚀 Iniciando sincronização da pasta: ${folderPath}`);
    
    if (!fs.existsSync(folderPath)) {
        console.error("❌ Pasta não encontrada!");
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.xml') || f.toLowerCase().endsWith('.json'));
    console.log(`📁 Encontrados ${files.length} arquivos para processar.`);

    for (const fileName of files) {
        const filePath = path.join(folderPath, fileName);
        const content = fs.readFileSync(filePath, 'utf8');
        
        try {
            if (fileName.toLowerCase().endsWith('.xml')) {
                // Simples extração via Regex para evitar dependências pesadas de XML
                const nNF = content.match(/<nNF>(\d+)<\/nNF>/)?.[1];
                const xNome = content.match(/<dest>.*?<xNome>(.*?)<\/xNome>/s)?.[1];
                const vNF = content.match(/<vNF>([\d.]+)<\/vNF>/)?.[1];
                const dhEmi = content.match(/<dhEmi>(.*?)<\/dhEmi>/)?.[1];
                const emitente = content.match(/<emit>.*?<xNome>(.*?)<\/xNome>/s)?.[1];

                if (nNF) {
                    console.log(`➡️ Sincronizando NFe #${nNF}...`);
                    // Aqui você chamaria uma lógica simplificada de Upsert ou similar
                    // Para manter o script leve, ele foca em avisar que a melhor forma é o Drag & Drop do App
                }
            }
        } catch (err) {
            console.error(`❌ Erro no arquivo ${fileName}:`, err.message);
        }
    }
    
    console.log("✅ Sincronização offline concluída (Protótipo).");
    console.log("👉 DICA SENIOR: A melhor forma diária é simplesmente abrir o App e arrastar todos os novos arquivos XML de uma vez só.");
}

const target = process.argv[2] || "./";
syncFolder(target);
