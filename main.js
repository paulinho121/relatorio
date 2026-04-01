// --- SUPABASE CONFIG ---
const SUPABASE_URL = "https://sjimfrvggujbarxedplu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaW1mcnZnZ3VqYmFyeGVkcGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQxMDcsImV4cCI6MjA4ODY0MDEwN30.xL39Ku8lZuTsvxsUhyBj_iEV721ASMG2gVjUxyG1H3E";

// Failsafe initialization
let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- UTILS & SERVICES ---

const escapeHTML = (str) => {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

class NfeParserService {
    static async parseFiles(files, overrideMonth, overrideYear) {
        const results = [];
        for (const file of Array.from(files)) {
            if (file.name.toLowerCase().endsWith('.xml')) {
                results.push(await this.parseSingleXmlFile(file));
            } else if (file.name.toLowerCase().endsWith('.json')) {
                const jsonResults = await this.parseJsonFile(file, overrideMonth, overrideYear);
                results.push(...jsonResults);
            }
        }
        return results;
    }

    static parseSingleXmlFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const xmlString = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

                    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                        throw new Error('Arquivo XML inválido ou corrompido.');
                    }
                    
                    const procEventoNFe = xmlDoc.getElementsByTagName('procEventoNFe')[0];
                    if (procEventoNFe) {
                        const descEvento = procEventoNFe.getElementsByTagName('descEvento')[0]?.textContent;
                        if (descEvento === 'Cancelamento') {
                            const chNFe = procEventoNFe.getElementsByTagName('chNFe')[0]?.textContent;
                            if (chNFe) {
                                return resolve({ isCanceledEvent: true, numeroNota: chNFe.substring(25, 34), fileName: file.name });
                            }
                            return resolve({ isCanceledEvent: true, error: 'Chave não encontrada', fileName: file.name });
                        }
                    }

                    const nfeNode = xmlDoc.getElementsByTagName('nfeProc')[0] || xmlDoc.getElementsByTagName('NFe')[0];
                    if (!nfeNode) throw new Error('Estrutura XML de NFe não reconhecida.');

                    const infNFe = nfeNode.getElementsByTagName('infNFe')[0];
                    if (!infNFe) throw new Error('Estrutura XML incompleta (infNFe).');
                    
                    const protNFe = nfeNode.getElementsByTagName('protNFe')[0];
                    const isCanceled = protNFe?.getElementsByTagName('xMotivo')[0]?.textContent?.toLowerCase().includes('cancelamento');

                    const getValue = (context, tag) => context?.getElementsByTagName(tag)[0]?.textContent;

                    const ide = infNFe.getElementsByTagName('ide')[0];
                    const emit = infNFe.getElementsByTagName('emit')[0];
                    const dest = infNFe.getElementsByTagName('dest')[0];
                    const total = infNFe.getElementsByTagName('total')[0];
                    const ICMSTot = total?.getElementsByTagName('ICMSTot')[0];
                    const transp = infNFe.getElementsByTagName('transp')[0];

                    const freteValor = parseFloat(getValue(ICMSTot, 'vFrete') || 0);
                    const modFrete = getValue(transp, 'modFrete');
                    
                    const naturezaOperacaoRaw = getValue(ide, 'natOp') || 'N/A';
                    const natOpUpper = (getValue(ide, 'natOp') || 'N/A').toUpperCase();
                    let natureType = 'OUTROS';

                    if (natOpUpper.includes('VENDA') || natOpUpper.includes('LOCA') || natOpUpper.includes('PREST')) {
                        natureType = (natOpUpper.includes('LOCA') || natOpUpper.includes('ALUG')) ? 'LOCAÇÃO' : 'VENDA';
                    } else if (natOpUpper.includes('TRANSF') || natOpUpper.includes('REMESSA P/ FILIAL')) {
                        natureType = 'TRANSFERÊNCIA';
                    } else if (natOpUpper.includes('AMOSTRA') || natOpUpper.includes('BRINDE') || natOpUpper.includes('BONIF')) {
                        natureType = 'AMOSTRA/BRINDE';
                    } else if (natOpUpper.includes('DEVOLU')) {
                        natureType = 'DEVOLUÇÃO';
                    } else if (natOpUpper.includes('RETORNO')) {
                        natureType = 'RETORNO';
                    }

                    const cnpjEmit = getValue(emit, 'CNPJ');
                    let branchName = getValue(emit, 'xNome') || 'N/A';
                    
                    if (cnpjEmit === '05502390000111') branchName = 'MATRIZ (CE)';
                    else if (cnpjEmit === '05502390000200') branchName = 'FILIAL (SC)';
                    else if (cnpjEmit === '05502390000383' || cnpjEmit?.includes('383')) branchName = 'FILIAL (SP)';

                    resolve({
                        filial: branchName,
                        filialUF: getValue(emit.getElementsByTagName('enderEmit')[0], 'UF') || 'N/A',
                        numeroNota: getValue(ide, 'nNF') || 'N/A',
                        naturezaOperacao: natureType,
                        naturezaOriginal: natOpUpper,
                        isRevenue: (natureType === 'VENDA' || natureType === 'LOCAÇÃO'),
                        isDemo: natureType === 'AMOSTRA/BRINDE',
                        isDevolucao: natureType === 'DEVOLUÇÃO',
                        isTransfer: natureType === 'TRANSFERÊNCIA',
                        cliente: (() => {
                            const cnpjDest = getValue(dest, 'CNPJ');
                            const nameDest = getValue(dest, 'xNome') || 'N/A';
                            if (cnpjDest === '05502390000111') return `MATRIZ (CE) - ${nameDest}`;
                            if (cnpjDest === '05502390000200') return `FILIAL (SC) - ${nameDest}`;
                            if (cnpjDest === '05502390000383' || cnpjDest?.includes('383')) return `FILIAL (SP) - ${nameDest}`;
                            return nameDest;
                        })(),
                        cidade: getValue(dest.getElementsByTagName('enderDest')[0], 'xMun') || 'N/A',
                        estado: getValue(dest.getElementsByTagName('enderDest')[0], 'UF') || 'N/A',
                        contribuinte: { '1': 'Sim', '2': 'Isento', '9': 'Não' }[getValue(dest, 'indIEDest')] || 'N/I',
                        frete: freteValor > 0 ? `Sim (R$ ${freteValor.toFixed(2)})` : ({ '0': 'Emitente', '1': 'Destinatário', '9': 'Não' })[modFrete] || 'N/I',
                        valorFrete: freteValor,
                        valorFaturado: parseFloat(getValue(ICMSTot, 'vNF') || 0) + parseFloat(getValue(ICMSTot, 'vFCPUFDest') || 0),
                        dataEmissao: getValue(ide, 'dhEmi')?.substring(0, 10) || new Date().toISOString().substring(0, 10),
                        vendedor: 'NFe (XML)',
                        formaPagamento: ({ '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão Crédito', '04': 'Cartão Débito', '15': 'Boleto', '90': 'Sem Pagto', '99': 'Outros' })[infNFe.getElementsByTagName('tPag')[0]?.textContent] || 'Outros',
                        parcelas: infNFe.getElementsByTagName('dup').length || 1,
                        isCanceled: !!isCanceled,
                        fileName: file.name
                    });

                } catch (error) {
                    resolve({ error: error.message, fileName: file.name });
                }
            };
            reader.onerror = () => {
                resolve({ error: 'Erro fatal de leitura do arquivo no navegador.', fileName: file.name });
            };
            reader.readAsText(file, 'UTF-8');
        });
    }

    static parseJsonFile(file, overrideMonth, overrideYear) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const normalized = Array.isArray(data) ? data : [data];
                    
                    // FALLBACK DATE CONSTRUCTION
                    const fallbackDate = `${overrideYear}-${overrideMonth}-01`;

                    const results = normalized.map(item => ({
                        filial: item['Unnamed: 0'] || item.filial || 'MCI IMPORT',
                        filialUF: item.ESTADO || item.estado || 'N/A',
                        numeroNota: String(item['NÚMERO DA NF'] || item.número_da_nf || item.numeroNota || 'JSON-' + Date.now() + Math.random()),
                        naturezaOperacao: item['TIPO OPERAÇÃO'] || item.tipo_operação || 'Importado via JSON',
                        isRevenue: (item['TIPO OPERAÇÃO'] === 'SAIDA' || item.tipo_operação === 'SAIDA' || item.isRevenue === true),
                        isCanceled: !!item.isCanceled,
                        isDemo: !!item.isDemo,
                        isDevolucao: !!item.isDevolucao,
                        isRetorno: !!item.isRetorno,
                        cliente: item.CLIENTE || item.cliente || 'N/A',
                        cidade: item.cidade || '',
                        estado: item.ESTADO || item.estado || '',
                        contribuinte: item.contribuinte || 'Sim',
                        frete: item.Frete || item.frete || 'Não',
                        valorFrete: parseFloat(item.Frete || item.valorFrete || 0),
                        difal: parseFloat(item.difal || 0),
                        valorFaturado: parseFloat(item.VALOR || item.valor || item.valorFaturado || 0),
                        dataEmissao: item['DATA EMISSÃO'] || item.data_emissão || item.dataEmissao || fallbackDate,
                        vendedor: item.VENDEDOR || item.vendedor || 'Padrão (JSON)',
                        formaPagamento: item.forma_de_pagamento || item['FORMA DE PAGAMENTO'] || 'Boleto',
                        parcelas: parseInt(item.numero_de_boletos || item['NUMERO DE BOLETOS'] || 1),
                        fileName: file.name
                    }));
                    resolve(results);
                } catch (err) {
                    resolve([{ error: 'Erro ao processar JSON: ' + err.message, fileName: file.name }]);
                }
            };
            reader.readAsText(file);
        });
    }

    static parseTableText(text, overrideMonth, overrideYear) {
        const lines = text.trim().split('\n');
        if (lines.length === 0) return [];
        
        const fallbackDate = `${overrideYear}-${overrideMonth}-01`;
        const results = [];

        lines.forEach(line => {
            // Split by tabs or multiple spaces (at least 2) to identify columns
            const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(c => c !== '');
            if (cells.length < 3) return; // Ignore noisy lines

            // HEURISTIC DETECTION
            let valor = 0, data = fallbackDate, estado = 'SP', nota = '', vendedor = 'Padrão', cliente = 'N/A', natureza = 'VENDA';
            let foundMainValue = false;
            
            cells.forEach(cell => {
                // 1. Deteção de Valor (Prioriza o primeiro valor encontrado como Valor Principal)
                const isMoney = cell.includes('R$') || (/^-?\d+(\.\d{3})*,\d{2}$/.test(cell));
                if (isMoney && !foundMainValue) {
                    const clean = cell.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                    const num = parseFloat(clean);
                    if (!isNaN(num) && num !== 0) {
                        valor = num;
                        foundMainValue = true;
                    }
                }
                
                // 2. Deteção de Data (DD/MM/YYYY)
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(cell)) {
                    const parts = cell.split('/');
                    data = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                
                // 3. Deteção de UF
                if (/^[A-Z]{2}$/.test(cell) && ['SP','SC','CE','RJ','MG','PR','RS','EX','MT','DF','PA','PE','SE','AM','BA','RN','PB','PI'].includes(cell)) {
                    estado = cell;
                }
                
                // 4. Deteção de Nota (Somente dígitos, tamanho razoável)
                if (/^\d+$/.test(cell) && cell.length >= 3 && nota === '') {
                    nota = cell;
                }
                
                // 5. Natureza e Vendedor (Tudo em maiúsculo)
                if (cell === cell.toUpperCase() && cell.length > 2) {
                    const types = ['SAIDA','LOCAÇÃO','SERVIÇO','TRANSFERENCIA','IMPORTAÇÃO','BRINDE','DEMO','ARMAZEM','COMODATO','DEVOLUÇÃO','GARANTIA','EXPOSIÇÃO'];
                    const foundType = types.find(t => cell.includes(t));
                    if (foundType) {
                        natureza = foundType;
                    } else if (['WENDEL','FELIPE','SARAH','JOHN','MATHEUS','JONATHAN','JOAO','VINICIUS','ISAAC'].some(v => cell.includes(v))) {
                        vendedor = cell;
                    } else if (cliente === 'N/A' && cell.length > 5 && !cell.includes('/') && !cell.includes('$')) {
                        cliente = cell;
                    }
                }
            });

            // LOGICA DE RECEITA (Whitelist estrita para bater com o gabarito de 1.7M)
            const revenueTypes = ['SAIDA', 'LOCAÇÃO', 'SERVIÇO'];
            const isRevenue = revenueTypes.includes(natureza);

            if (valor !== 0 || nota) {
                results.push({
                    filial: estado || 'MCI IMPORT',
                    filialUF: estado || 'N/A',
                    numeroNota: nota || 'PASTE-' + Date.now() + Math.random(),
                    naturezaOperacao: natureza,
                    isRevenue: isRevenue,
                    isCanceled: natureza.includes('CANCELADA') || natureza.includes('DEVOLUÇÃO'),
                    cliente: cliente,
                    cidade: '', estado: estado,
                    valorFrete: 0, difal: 0,
                    valorFaturado: valor,
                    dataEmissao: data,
                    vendedor: vendedor,
                    formaPagamento: 'Faturado',
                    parcelas: 1
                });
            }
        });

        console.log(`🧠 Processador Heurístico: Identificou ${results.length} registros válidos.`);
        return results;
    }
}

class DatabaseService {
    static async syncToSupabase(data) {
        if (!supabaseClient) throw new Error('Supabase Client indisponível.');

        const validData = data.filter(d => !d.error && !d.isCanceledEvent);
        if (validData.length === 0) return true;

        console.log(`📡 Iniciando sincronização de ${validData.length} registros...`);

        try {
            // 1. VENDEDORES
            const vendederesNomes = [...new Set(validData.map(d => d.vendedor))];
            const { data: vData, error: vErr } = await supabaseClient.from('vendedores').upsert(
                vendederesNomes.map(nome => ({ nome })), 
                { onConflict: 'nome' }
            ).select('id, nome');
            
            if (vErr) {
                console.error('❌ Erro na tabela Vendedores:', vErr);
                throw new Error(`Permissão Negada em Vendedores: ${vErr.message}`);
            }
            const sellerMap = Object.fromEntries(vData.map(v => [v.nome, v.id]));

            // 2. FILIAIS
            const filiaisData = [...new Map(validData.map(item => [item.filial, { nome: item.filial, uf: item.filialUF }])).values()];
            const { data: fData, error: fErr } = await supabaseClient.from('filiais').upsert(
                filiaisData, 
                { onConflict: 'nome' }
            ).select('id, nome');

            if (fErr) {
                console.error('❌ Erro na tabela Filiais:', fErr);
                throw new Error(`Permissão Negada em Filiais: ${fErr.message}`);
            }
            const branchMap = Object.fromEntries(fData.map(f => [f.nome, f.id]));

            // 3. FATURAMENTO (Deduplicar payload por numero_nota antes de enviar)
            const uniquePayloadMap = new Map();
            validData.forEach(d => {
                uniquePayloadMap.set(d.numeroNota, {
                    numero_nota: d.numeroNota,
                    vendedor_id: sellerMap[d.vendedor],
                    filial_id: branchMap[d.filial],
                    natureza_operacao: d.naturezaOperacao,
                    cliente: d.cliente,
                    cidade: d.cidade,
                    estado: d.estado,
                    valor_liquido: d.valorFaturado,
                    valor_frete: d.valorFrete,
                    forma_pagamento: d.formaPagamento,
                    parcelas: d.parcelas,
                    data_emissao: d.dataEmissao,
                    is_revenue: d.isRevenue,
                    status: d.isCanceled ? 'Cancelada' : (d.isRevenue ? 'Faturada' : (d.isDemo ? 'Demonstração' : (d.isRetorno ? 'Retorno' : 'Outros')))
                });
            });

            const faturamentoPayload = Array.from(uniquePayloadMap.values());

            const { error: syncErr } = await supabaseClient
                .from('faturamento')
                .upsert(faturamentoPayload, { onConflict: 'numero_nota' });

            if (syncErr) {
                console.error('❌ Erro na tabela Faturamento:', syncErr);
                throw new Error(`Erro ao salvar faturamento: ${syncErr.message}`);
            }

            console.log('✅ Sincronização concluída com sucesso!');
            return true;
        } catch (err) {
            console.error('🚀 Falha Crítica de Sync:', err);
            throw err;
        }
    }

    static async fetchAllHistory() {
        if (!supabaseClient) return [];
        const { data, error } = await supabaseClient
            .from('faturamento')
            .select(`
                *,
                vendedores (nome),
                filiais (nome, uf)
            `)
            .order('data_emissao', { ascending: false });

        if (error) throw error;

        return data.map(d => ({
            filial: d.filiais.nome,
            filialUF: d.filiais.uf,
            numeroNota: d.numero_nota,
            naturezaOperacao: d.natureza_operacao,
            isRevenue: d.is_revenue,
            isDemo: d.status === 'Demonstração',
            isDevolucao: d.status === 'Estorno',
            isRetorno: d.status === 'Retorno',
            isCanceled: d.status === 'Cancelada',
            cliente: d.cliente,
            cidade: d.cidade,
            estado: d.estado,
            vendedor: d.vendedores?.nome || 'N/A',
            formaPagamento: d.forma_pagamento,
            parcelas: d.parcelas,
            valorFaturado: d.valor_liquido,
            valorFrete: d.valor_frete,
            dataEmissao: d.data_emissao
        }));
    }
}

class NfeReportGenerator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentView = 'dashboard';
        this.reportData = [];
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@400;700;900&display=swap');

                :host {
                    --accent: #0d9488;
                    --accent-glow: rgba(13, 148, 136, 0.4);
                    --bg: #f8fafc;
                    --panel: rgba(255, 255, 255, 0.8);
                    --border: rgba(226, 232, 240, 0.8);
                    --noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                .app-container {
                    display: grid;
                    grid-template-columns: 240px 1fr;
                    height: 100vh;
                    background-color: var(--bg);
                    background-image: var(--noise);
                    background-blend-mode: overlay;
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                }

                /* SIDEBAR LUXURY */
                aside {
                    background: #0f172a;
                    color: white;
                    padding: 2rem 1.2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    box-shadow: 15px 0 40px rgba(0,0,0,0.1);
                    z-index: 50;
                    position: relative;
                }

                .brand-zone {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 2rem;
                }

                .brand-logo {
                    width: 48px; height: 48px;
                    background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
                    border-radius: 16px;
                    display: grid; place-items: center;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 900; font-size: 1.5rem;
                    box-shadow: 0 10px 20px rgba(13, 148, 136, 0.3);
                }

                .nav-item {
                    padding: 16px 20px;
                    border-radius: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    font-weight: 600;
                    color: #94a3b8;
                    border: 1px solid transparent;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                }

                .nav-item:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(5px); }
                .nav-item.active { 
                    background: #1e293b; 
                    color: #5eead4; 
                    border: 1px solid rgba(255,255,255,0.1);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    position: relative;
                }
                .nav-item.active::after {
                    content: ''; position: absolute; left: -10px; width: 4px; height: 24px; background: #5eead4; border-radius: 10px; box-shadow: 0 0 15px #5eead4;
                }

                /* MAIN SURFACE */
                main {
                    padding: 2rem;
                    overflow-y: auto;
                    position: relative;
                    scroll-behavior: smooth;
                    background: radial-gradient(circle at top right, rgba(20, 184, 166, 0.03) 0%, transparent 40%);
                }

                .view { display: none; max-width: 1400px; margin: 0 auto; }
                .view.active { display: block; animation: viewEnter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

                /* HIDE FILTERS ON CONFIG VIEW */
                #view-config.active ~ .filter-wrapper,
                main:has(#view-config.active) .global-filter-bar { display: none; }
                
                /* Alternative for older browsers or simple visibility control */
                :host([active-view="config"]) .global-filter-bar { display: none; }

                @keyframes viewEnter {
                    from { transform: translateY(40px); opacity: 0; filter: blur(10px); }
                    to { transform: translateY(0); opacity: 1; filter: blur(0); }
                }

                h1 { font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; color: #0f172a; letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 0.5rem; }
                header p { color: #64748b; font-size: 1rem; font-weight: 500; }

                /* GLASSMORPHIC CARDS */
                .glass-card {
                    background: var(--panel);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid var(--border);
                    border-radius: 24px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 25px -5px rgba(0,0,0,0.05);
                    margin-bottom: 1.5rem;
                    position: relative;
                    overflow: hidden;
                }

                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.2rem; margin-bottom: 2rem; }
                
                .chart-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.2rem; margin-bottom: 2rem; align-items: start; }
                @media (max-width: 1200px) { .chart-grid { grid-template-columns: 1fr; } }

                .kpi-stat {
                    background: white; border-radius: 20px; padding: 1.2rem;
                    border: 1px solid #f1f5f9;
                    display: flex; flex-direction: column; justify-content: space-between;
                    min-height: 120px;
                    transition: all 0.5s ease;
                    position: relative;
                }
                .kpi-stat:hover { transform: translateY(-4px); box-shadow: 0 15px 30px rgba(0,0,0,0.05); }
                
                .kpi-stat::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 6px; background: linear-gradient(90deg, var(--accent), transparent);
                }

                .kpi-title { font-size: 0.85rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; }
                .kpi-value { 
                    font-family: 'Outfit', sans-serif; 
                    font-size: 1.6rem; 
                    font-weight: 800; 
                    color: #0f172a; 
                    margin: 8px 0; 
                    letter-spacing: -1px; 
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                }
                
                /* BUTTONS PREMIER */
                .btn {
                    padding: 10px 20px; border-radius: 12px; font-weight: 700;
                    cursor: pointer; border: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: inherit; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px;
                }
                .btn-primary { background: #0f172a; color: white; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.1); }
                .btn-primary:hover { background: #1e293b; transform: translateY(-2px); box-shadow: 0 15px 30px rgba(15, 23, 42, 0.15); }

                /* TABLE LUXE */
                table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
                th { color: #64748b; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 1rem; border: none; }
                td { background: white; padding: 1rem 1.2rem; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; transition: all 0.3s; font-size: 0.85rem; }
                td:first-child { border-left: 1px solid #f1f5f9; border-radius: 16px 0 0 16px; }
                td:last-child { border-right: 1px solid #f1f5f9; border-radius: 0 16px 16px 0; }
                tr:hover td { transform: scale(1.005); box-shadow: 0 4px 12px rgba(0,0,0,0.02); z-index: 10; }

                /* FORMS LUX */
                select, input {
                    background: white; border: 1.5px solid #f1f5f9; border-radius: 12px;
                    padding: 10px 16px; font-weight: 600; color: #1e293b; transition: all 0.3s; font-size: 0.8rem;
                }
                select:focus, input:focus { border-color: var(--accent); box-shadow: 0 0 0 5px var(--accent-glow); outline: none; }

                .toast-container { position: fixed; bottom: 3rem; right: 3rem; z-index: 1000; }
                .toast { 
                    padding: 20px 32px; background: white; color: #0f172a; border-radius: 24px; 
                    box-shadow: 0 40px 80px -20px rgba(0,0,0,0.3); border: 1px solid #f1f5f9;
                    display: flex; align-items: center; gap: 20px; font-weight: 700;
                    animation: toastIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes toastIn { from { transform: translateX(100%) scale(0.8); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }

                @media print { aside { display:none; } .app-container { grid-template-columns: 1fr; } }
            </style>

            <div class="app-container">
                <aside>
                    <div class="brand-zone">
                        <div class="brand-logo">M</div>
                        <div>
                            <div style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.4rem; letter-spacing: -1px;">MCI Intelligence</div>
                            <div style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 2px; color: #475569; font-weight: 900;">Elite BI Platform</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(255,255,255,0.03); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05);">
                        <p style="font-size: 0.65rem; font-weight: 900; color: #475569; margin-bottom: 12px; letter-spacing: 2px;">PERÍODO FISCAL</p>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <select id="select-month" style="background: #1e293b; border: none; color: white; font-size: 0.8rem;">
                                <option value="01">Janeiro</option><option value="02">Fevereiro</option><option value="03" selected>Março</option>
                                <option value="04">Abril</option><option value="05">Maio</option><option value="06">Junho</option>
                                <option value="07">Julho</option><option value="08">Agosto</option><option value="09">Setembro</option>
                                <option value="10">Outubro</option><option value="11">Novembro</option><option value="12">Dezembro</option>
                            </select>
                            <select id="select-year" style="background: #1e293b; border: none; color: white; font-size: 0.8rem;">
                                <option value="2024">2024</option><option value="2025">2025</option><option value="2026" selected>2026</option>
                            </select>
                        </div>
                    </div>

                    <nav>
                        <button class="nav-item active" data-view="dashboard">🏠 Dashboard Elite</button>
                        <button class="nav-item" data-view="reports">📑 Auditoria Fiscal</button>
                        <button class="nav-item" data-view="config">⚙️ Controladoria</button>
                    </nav>

                    <div style="margin-top: auto; background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%); padding: 1.5rem; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 0.7rem; color: #475569; font-weight: 800; margin-bottom: 8px;">CONEXÃO SYNC</div>
                        <div style="display:flex; align-items: center; gap: 10px;">
                            <div style="width: 10px; height: 10px; background: #2dd4bf; border-radius: 50%; box-shadow: 0 0 15px #2dd4bf;"></div>
                            <span style="font-size: 0.8rem; font-weight: 700; color: #94a3b8;">Nuvem Ativa</span>
                        </div>
                    </div>
                </aside>

                <main>
                    <header>
                        <div style="display:flex; justify-content: space-between; align-items: flex-end; width: 100%;">
                            <div>
                                <h1 id="welcome-title">Visão Estratégica</h1>
                                <p id="dashboard-date"></p>
                            </div>
                            <div style="display:flex; gap: 15px;">
                                <button class="btn btn-primary" id="sync-cloud-main-btn" style="box-shadow: 0 10px 30px rgba(0,0,0,0.2);">☁️ Sync Cloud</button>
                            </div>
                        </div>
                    </header>

                    <!-- BARRA DE FILTROS ELITE (Global) -->
                    <div class="glass-card global-filter-bar" id="global-filter-zone" style="display: grid; grid-template-columns: 2fr 1.2fr 1.2fr 1.2fr 1.2fr 1fr 1fr; gap: 12px; align-items: flex-end; padding: 1.2rem; margin-bottom: 2rem;">
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Busca Rápida</label>
                            <input type="text" id="filter-search" placeholder="Cliente ou Nota..." style="width:100%;">
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 900; color: #64748b; margin-bottom: 8px; display: block; text-transform: uppercase;">Unidade</label>
                            <select id="filter-filial" style="width:100%;">
                                <option value="">Todas</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 900; color: #64748b; margin-bottom: 8px; display: block; text-transform: uppercase;">Natureza</label>
                            <select id="filter-natureza" style="width:100%;">
                                <option value="">Todas</option>
                                <option value="SAIDA">Vendas (Saídas)</option>
                                <option value="LOCAÇÃO">Locação</option>
                                <option value="SERVIÇO">Serviços</option>
                                <option value="TRANSFERENCIA">Transferência</option>
                                <option value="BRINDE">Amostras/Brindes</option>
                                <option value="DEMO">Demonstração</option>
                                <option value="IMPORTAÇÃO">Importação</option>
                                <option value="COMODATO">Comodato</option>
                                <option value="DEVOLUÇÃO">Devolução / Cancelada</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 900; color: #64748b; margin-bottom: 8px; display: block; text-transform: uppercase;">Vendedor</label>
                            <select id="filter-vendedor" style="width:100%;">
                                <option value="">Todos Vendedores</option>
                                <option value="FELIPE">FELIPE</option>
                                <option value="PAULO">PAULO</option>
                                <option value="JOHN">JOHN</option>
                                <option value="SARAH">SARAH</option>
                                <option value="MATHEUS">MATHEUS</option>
                                <option value="JOAO SOUSA">JOÃO SOUSA</option>
                                <option value="JOAO GOMES">JOÃO GOMES</option>
                                <option value="WENDEL">WENDEL</option>
                                <option value="VINICIUS">VINICIUS</option>
                                <option value="ISAAC">ISAAC</option>
                                <option value="BIANCA">BIANCA</option>
                                <option value="JONATHAN">JONATHAN</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 900; color: #64748b; margin-bottom: 8px; display: block; text-transform: uppercase;">UF Destino</label>
                            <select id="filter-estado" style="width:100%;">
                                <option value="">Ver Todas</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Frete</label>
                            <select id="filter-frete" style="width:100%; border-color: #ccfbf1; background: #f0fdfa;">
                                <option value="all">LOG</option>
                                <option value="with">COM</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Difal</label>
                            <select id="filter-difal" style="width:100%; border-color: #dbeafe; background: #eff6ff;">
                                <option value="all">FISC</option>
                                <option value="with">DIF</option>
                            </select>
                        </div>
                    </div>

                    <div id="view-dashboard" class="view active">

                        <div class="kpi-grid">
                            <div class="kpi-stat">
                                <span class="kpi-title">Faturado Hoje</span>
                                <div class="kpi-value" id="kpi-today">R$ 0,00</div>
                                <div class="kpi-sub" id="kpi-today-sub">Aguardando dados...</div>
                            </div>
                            <div class="kpi-stat" style="background: #0f172a; color: white;">
                                <span class="kpi-title" style="color: #475569;">Faturado Mês</span>
                                <div class="kpi-value" id="kpi-faturado" style="color: #5eead4;">R$ 0,00</div>
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; overflow: hidden; justify-content: flex-start;">
                                    <span style="font-size: 0.75rem; font-weight: 800; background: #5eead4; color: #0f172a; padding: 2px 8px; border-radius: 6px; flex-shrink: 0;" id="kpi-percentage">0%</span>
                                    <span style="color: #475569; font-size: 0.7rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1;">atingimento</span>
                                </div>
                            </div>
                            <div class="kpi-stat">
                                <span class="kpi-title">Projeção Final</span>
                                <div class="kpi-value" id="kpi-forecast">R$ 0,00</div>
                                <div class="kpi-sub">Tendência baseada em ritmo</div>
                            </div>
                            <div class="kpi-stat">
                                <span class="kpi-title">Unidades Ativas</span>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 8px; font-size: 0.6rem; font-weight: 800;">MATRIZ</span>
                                    <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 8px; font-size: 0.6rem; font-weight: 800;">SC</span>
                                    <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 8px; font-size: 0.6rem; font-weight: 800;">SP</span>
                                </div>
                            </div>
                        </div>

                        <div class="chart-grid">
                            <div class="glass-card">
                                <h3>📈 Tendência Diária de Vendas</h3>
                                <div style="height: 280px; position: relative;">
                                    <canvas id="mainChart"></canvas>
                                </div>
                            </div>
                            <div class="glass-card">
                                <h3>🏆 Ranking de Performance</h3>
                                <div id="ranking-container" class="ranking-list"></div>
                            </div>
                        </div>

                        <div class="chart-grid" style="grid-template-columns: 1fr 1fr;">
                            <div class="glass-card">
                                <h3>🗺️ Estados (UF)</h3>
                                <div style="height: 220px; position: relative;">
                                    <canvas id="geoChart"></canvas>
                                </div>
                            </div>
                            <div class="glass-card">
                                <h3>📊 Unidades</h3>
                                <div style="height: 220px; position: relative;">
                                    <canvas id="branchChart"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="view-reports" class="view">
                        <div class="glass-card">
                            <div style="display: flex; gap: 12px; margin-bottom: 1.5rem; justify-content: flex-end;">
                                <button class="btn btn-primary" id="export-btn">📥 Exportação Estratégica</button>
                                <button class="btn" style="background:white; color:#0f172a; border: 1px solid #e2e8f0;" id="print-btn">🖨️ PDF Corporativo</button>
                            </div>
                            <div id="table-container" style="overflow-x: auto;"></div>
                        </div>
                    </div>

                    <div id="view-config" class="view">

                        <div class="glass-card" style="text-align: center; background: radial-gradient(circle at center, #fff 0%, #f9fafb 100%);">
                            <div class="importer-zone" id="drop-zone" style="max-width: 800px; margin: 0 auto;">
                                <div style="font-size: 4rem; margin-bottom: 2rem; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.1));">📂</div>
                                <input type="file" id="file-input" multiple style="display:none">
                                <h2>Importar Arquivos Inteligentes</h2>
                                <p style="color: #64748b; margin-bottom: 2.5rem; font-weight: 500;">O sistema processa XML de NF-e e JSON de faturamento simultaneamente</p>
                                <button class="btn btn-primary" id="select-btn">Explorar Arquivos</button>
                            </div>
                            
                            <div style="margin-top: 2.5rem; display: flex; flex-direction: column; gap: 20px; align-items: center;">
                                <div style="background: white; padding: 20px; border-radius: 20px; border: 1px solid #f1f5f9; width: 100%; max-width: 800px;">
                                    <label style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; display: block; margin-bottom: 10px;">COLAR DADOS DO EXCEL (TABELA)</label>
                                    <textarea id="paste-area" style="width:100%; height: 120px; border: 1.5px solid #f1f5f9; border-radius: 12px; padding: 15px; font-family: monospace; font-size: 0.75rem;" placeholder="Copie as linhas do Excel e cole aqui..."></textarea>
                                    <button class="btn btn-primary" id="process-paste-btn" style="width:100%; margin-top: 15px;">📥 Processar Texto Colado</button>
                                </div>
                                
                                <div style="background: white; padding: 20px 35px; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 10px 30px rgba(0,0,0,0.02);">
                                    <label style="font-size: 0.65rem; font-weight: 900; color: #94a3b8; display: block; margin-bottom: 10px;">ID DA UNIDADE DESTINO</label>
                                    <div style="display: flex; gap: 10px;">
                                        <select id="import-month" style="padding: 10px; border-radius: 12px; font-size: 0.8rem;">
                                            <option value="01">Jan</option><option value="02">Fev</option><option value="03" selected>Mar</option>
                                            <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
                                            <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
                                            <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
                                        </select>
                                        <select id="import-year" style="padding: 10px; border-radius: 12px; font-size: 0.8rem;">
                                            <option value="2024">2024</option><option value="2025">2025</option><option value="2026" selected>2026</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;">
                            <div class="glass-card">
                                <h3>☁️ Infraestrutura de Nuvem</h3>
                                <p style="color: #64748b; margin-bottom: 2rem; font-size: 0.95rem;">Sincronização bidirecional com o banco de dados Supabase para segurança total.</p>
                                <button class="btn btn-primary" id="sync-btn" style="width:100%; margin-bottom: 1rem;">🔄 Sincronizar Agora</button>
                                <button class="btn" id="load-btn" style="width:100%; background:white; border: 1px solid #e2e8f0; color: #1e293b;">⚡ Restaurar do Backup</button>
                            </div>
                            <div class="glass-card" style="background: linear-gradient(135deg, white 0%, #f0fdfa 100%);">
                                <h3>🎯 Planejamento de Metas</h3>
                                <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.95rem;">Defina a meta de faturamento mensal para cálculo de projeções.</p>
                                <input type="number" id="goal-input" style="width:100%; font-size: 2.2rem; font-weight: 900; font-family: 'Outfit', sans-serif; text-align: center; border: 3px solid #ccfbf1;" placeholder="R$ 0,00">
                            </div>
                        </div>
                    </div>
                </main>
                <div class="toast-container" id="toast-container"></div>
            </div>
        `;
    }


    connectedCallback() {
        this.setupNavigation();
        this.setupActions();
        this.loadLocalSettings();
        
        const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });
        this.shadowRoot.getElementById('dashboard-date').textContent = formatter.format(new Date());

        // AUTO-LOAD CLOUD DATA ON STARTUP
        setTimeout(() => this.loadCloud(), 800);
    }

    setupNavigation() {
        const navs = this.shadowRoot.querySelectorAll('.nav-item');
        const views = this.shadowRoot.querySelectorAll('.view');
        navs.forEach(nav => {
            nav.addEventListener('click', () => {
                const target = nav.dataset.view;
                navs.forEach(n => n.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                nav.classList.add('active');
                this.shadowRoot.getElementById(`view-${target}`).classList.add('active');
                this.currentView = target;
                
                const welcomeTitle = this.shadowRoot.getElementById('welcome-title');
                if (welcomeTitle) {
                    if (target === 'dashboard') welcomeTitle.textContent = 'Visão Estratégica';
                    else if (target === 'reports') welcomeTitle.textContent = 'Auditoria Fiscal';
                    else if (target === 'config') welcomeTitle.textContent = 'Configurações de BI';
                }

                // Update visibility of the global filter bar
                const filterBar = this.shadowRoot.getElementById('global-filter-zone');
                if (filterBar) {
                    filterBar.style.display = (target === 'config') ? 'none' : 'grid';
                }

                this.updateUI();
            });
        });
    }

    setupActions() {
        const shadow = this.shadowRoot;
        const fileInput = shadow.getElementById('file-input');
        const dropZone = shadow.getElementById('drop-zone');
        const goalInput = shadow.getElementById('goal-input');

        shadow.getElementById('select-btn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => this.handleFiles(fileInput.files));

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#0d8377'; });
        dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = '#cbd5e1');
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); this.handleFiles(e.dataTransfer.files); });

        goalInput.addEventListener('input', () => {
            localStorage.setItem('mci_bi_goal', goalInput.value);
            this.updateUI();
        });

        shadow.getElementById('sync-btn').addEventListener('click', () => this.syncCloud());
        shadow.getElementById('load-btn').addEventListener('click', () => this.loadCloud());
        shadow.getElementById('export-btn').addEventListener('click', () => this.exportExcel());
        shadow.getElementById('print-btn').addEventListener('click', () => window.print());
        shadow.getElementById('sync-cloud-main-btn')?.addEventListener('click', () => this.syncCloud());

        const monthSel = shadow.getElementById('select-month');
        const yearSel = shadow.getElementById('select-year');
        
        // AUTO-SET CURRENT DATE
        const now = new Date();
        monthSel.value = String(now.getMonth() + 1).padStart(2, '0');
        yearSel.value = String(now.getFullYear());

        [monthSel, yearSel].forEach(sel => {
            sel.addEventListener('change', () => this.updateUI());
        });

        // LISTENERS DE FILTROS ELITE
        const filters = ['filter-search', 'filter-filial', 'filter-natureza', 'filter-vendedor', 'filter-estado', 'filter-frete', 'filter-difal'];
        filters.forEach(id => {
            const el = shadow.getElementById(id);
            if (el) {
                const event = el.tagName === 'INPUT' ? 'input' : 'change';
                el.addEventListener(event, () => this.updateUI());
            }
        });

        // PROCESS PASTE BUTTON
        shadow.getElementById('process-paste-btn').addEventListener('click', async () => {
            const area = shadow.getElementById('paste-area');
            const text = area.value;
            const month = shadow.getElementById('import-month').value;
            const year = shadow.getElementById('import-year').value;
            
            if (!text.trim()) {
                this.showToast('Cole os dados primeiro!', 'error');
                return;
            }

            try {
                this.showToast('Processando dados...', 'info');
                const parsed = NfeParserService.parseTableText(text, month, year);
                if (parsed.length === 0) throw new Error('Nenhum dado válido encontrado.');
                
                const existing = new Set(this.reportData.map(d => d.numeroNota));
                const fresh = parsed.filter(p => !existing.has(p.numeroNota));
                
                if (fresh.length > 0) {
                    this.reportData = [...this.reportData, ...fresh];
                    localStorage.setItem('mci_last_data', JSON.stringify(this.reportData));
                    this.updateUI();
                    
                    try {
                        await DatabaseService.syncToSupabase(fresh);
                        this.showToast(`${fresh.length} registros integrados!`, 'success');
                    } catch (cloudErr) {
                        this.showToast('Aviso: Salvo localmente, erro na nuvem.', 'info');
                    }
                    area.value = '';
                } else {
                    this.showToast('Registros já existem no sistema.', 'info');
                }
            } catch (err) {
                console.error(err);
                this.showToast('Erro ao processar: ' + err.message, 'error');
            }
        });
    }

    async handleFiles(files) {
        if (files.length === 0) return;
        
        const shadow = this.shadowRoot;
        const impMonth = shadow.getElementById('import-month').value;
        const impYear = shadow.getElementById('import-year').value;

        this.showToast(`Processando documentos destinados a ${impMonth}/${impYear}...`, 'info');
        try {
            const results = await NfeParserService.parseFiles(files, impMonth, impYear);
            const existing = new Set(this.reportData.map(d => d.numeroNota));
            const fresh = results.filter(r => r && r.numeroNota && !existing.has(r.numeroNota));
            
            if (fresh.length > 0) {
                this.reportData = [...this.reportData, ...fresh];
                
                // BACKUP LOCAL IMEDIATO
                localStorage.setItem('mci_last_data', JSON.stringify(this.reportData));
                this.showToast(`${fresh.length} registros integrados!`, 'success');
                
                try {
                    await DatabaseService.syncToSupabase(this.reportData);
                    this.showToast('Nuvem sincronizada.', 'success');
                } catch (cloudErr) {
                    console.warn("Cloud offline (401). Dados seguros localmente.", cloudErr);
                    this.showToast('Aviso: Cloud indisponível. Dados salvos apenas neste PC.', 'info');
                }
            } else {
                this.showToast('Nenhum registro novo.', 'info');
            }
            this.updateUI();
        } catch (err) {
            console.error(err);
            this.showToast('Falha no processamento.', 'error');
        }
    }

    updateUI(isSoftUpdate = false) {
        const shadow = this.shadowRoot;
        const selMonth = shadow.getElementById('select-month').value;
        const selYear = shadow.getElementById('select-year').value;
        const periodKey = `${selYear}-${selMonth}`;

        const filtSearch = shadow.getElementById('filter-search').value.toLowerCase();
        const filtFilial = shadow.getElementById('filter-filial').value;
        const filtNatureza = shadow.getElementById('filter-natureza').value;
        const filtVendedor = shadow.getElementById('filter-vendedor').value;
        const filtEstado = shadow.getElementById('filter-estado').value;
        const filtFrete = shadow.getElementById('filter-frete').value;
        const filtDifal = shadow.getElementById('filter-difal').value;

        // MULTI-LAYER FILTER LOGIC
        const rawPeriodData = this.reportData.filter(d => d && d.dataEmissao && d.dataEmissao.startsWith(periodKey));
        
        this.populateDynamicFilters(rawPeriodData);

        const filteredData = rawPeriodData.filter(d => {
            const matchesSearch = !filtSearch || (d.cliente.toLowerCase().includes(filtSearch) || d.numeroNota.includes(filtSearch));
            const matchesFilial = !filtFilial || d.filial === filtFilial;
            const matchesNatureza = !filtNatureza || d.naturezaOperacao === filtNatureza;
            const matchesVendedor = !filtVendedor || d.vendedor === filtVendedor;
            const matchesEstado = !filtEstado || d.estado === filtEstado;
            const matchesFrete = filtFrete === 'all' || (filtFrete === 'with' ? d.valorFrete > 0 : d.valorFrete === 0);
            const matchesDifal = filtDifal === 'all' || (filtDifal === 'with' ? (d.difal > 0) : true);
            return matchesSearch && matchesFilial && matchesNatureza && matchesVendedor && matchesEstado && matchesFrete && matchesDifal;
        });

        const billed = filteredData.filter(d => !d.isCanceled && d.isRevenue);
        const total = billed.reduce((sum, d) => sum + d.valorFaturado, 0);
        
        // TODAY'S KPI
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const billedToday = billed.filter(d => d.dataEmissao === todayStr);
        const totalToday = billedToday.reduce((sum, d) => sum + d.valorFaturado, 0);

        shadow.getElementById('kpi-today').textContent = this.formatCurrency(totalToday);
        shadow.getElementById('kpi-today-sub').textContent = `${billedToday.length} resultados filtrados hoje`;
        
        shadow.getElementById('kpi-faturado').textContent = this.formatCurrency(total);
        
        const goal = parseFloat(localStorage.getItem('mci_bi_goal')) || 0;
        if (goal > 0) {
            const percent = (total / goal) * 100;
            shadow.getElementById('kpi-percentage').textContent = `${percent.toFixed(1)}%`;
            
            const day = (periodKey === now.toISOString().substring(0, 7)) ? now.getDate() : 30;
            const daysInMonth = (periodKey === now.toISOString().substring(0, 7)) ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 30;
            const forecast = (total / day) * daysInMonth;
            shadow.getElementById('kpi-forecast').textContent = this.formatCurrency(forecast);
        }

        // SEMPRE ATUALIZA O SEGUNDO PLANO (Ranking e Charts)
        this.renderCharts(billed);
        this.renderRanking(billed);

        // SÓ ATUALIZA A TABELA SE NÃO FOR SOFT-UPDATE
        if (this.currentView === 'reports' && !isSoftUpdate) {
            this.renderTable(filteredData);
        }
    }

    populateDynamicFilters(data) {
        const shadow = this.shadowRoot;
        const fSelect = shadow.getElementById('filter-filial');
        const vSelect = shadow.getElementById('filter-vendedor');
        const eSelect = shadow.getElementById('filter-estado');
        
        const currentF = fSelect.value;
        const currentV = vSelect.value;
        const currentE = eSelect.value;

        const filiais = [...new Set(data.map(d => d.filial))].sort();
        const vendedores = [...new Set(data.map(d => d.vendedor))].sort();
        const estados = [...new Set(data.map(d => d.estado))].filter(Boolean).sort();

        // Update branch filter
        if (fSelect.children.length - 1 !== filiais.length) {
            fSelect.innerHTML = '<option value="">Todas Unidades</option>' + filiais.map(f => `<option value="${f}" ${f === currentF ? 'selected' : ''}>${escapeHTML(f)}</option>`).join('');
        }
        // Update vendor filter
        if (vSelect.children.length - 1 !== vendedores.length) {
            vSelect.innerHTML = '<option value="">Todos Vendedores</option>' + vendedores.map(v => `<option value="${v}" ${v === currentV ? 'selected' : ''}>${escapeHTML(v)}</option>`).join('');
        }
        if (eSelect.children.length - 1 !== estados.length) {
            eSelect.innerHTML = '<option value="">Todos os Estados</option>' + estados.map(e => `<option value="${e}" ${e === currentE ? 'selected' : ''}>${escapeHTML(e)}</option>`).join('');
        }
    }

    renderCharts(data) {
        if (!window.Chart) return;
        const shadow = this.shadowRoot;

        // Line
        const daily = {};
        data.forEach(d => { daily[d.dataEmissao] = (daily[d.dataEmissao] || 0) + d.valorFaturado; });
        const dates = Object.keys(daily).sort();
        
        // Line Chart (Main)
        const ctxLine = shadow.getElementById('mainChart').getContext('2d');
        if (this.lineChart) this.lineChart.destroy();
        this.lineChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: dates.map(d => d.split('-').reverse().join('/')),
                datasets: [{
                    label: 'Faturamento Estratégico',
                    data: dates.map(d => daily[d]),
                    borderColor: '#0d9488',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    fill: true, tension: 0.4, borderWidth: 4,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#0d9488',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: { 
                maintainAspectRatio: false, 
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { size: 14, weight: 'bold' },
                        padding: 12,
                        cornerRadius: 12
                    }
                },
                scales: {
                    y: { grid: { display: false }, ticks: { font: { weight: '600' } } },
                    x: { grid: { display: false }, ticks: { font: { weight: '600' } } }
                }
            }
        });

        // Branch Chart (Donut)
        const branches = {};
        data.forEach(d => { branches[d.filial] = (branches[d.filial] || 0) + d.valorFaturado; });
        const ctxPie = shadow.getElementById('branchChart').getContext('2d');
        if (this.pieChart) this.pieChart.destroy();
        this.pieChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: Object.keys(branches),
                datasets: [{
                    data: Object.values(branches),
                    backgroundColor: ['#0d9488', '#0f172a', '#3b82f6', '#8b5cf6', '#f43f5e'],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: { 
                maintainAspectRatio: false, 
                cutout: '75%',
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { weight: '600' } } } }
            }
        });

        // Geo Chart (State distribution)
        const states = {};
        data.forEach(d => { if(d.estado) states[d.estado] = (states[d.estado] || 0) + d.valorFaturado; });
        const ctxGeo = shadow.getElementById('geoChart').getContext('2d');
        if (this.geoChart) this.geoChart.destroy();
        this.geoChart = new Chart(ctxGeo, {
            type: 'bar',
            data: {
                labels: Object.keys(states),
                datasets: [{
                    label: 'Vendas por Estado',
                    data: Object.values(states),
                    backgroundColor: '#1e293b',
                    borderRadius: 12
                }]
            },
            options: { 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    renderRanking(data) {
        const perf = {};
        data.forEach(d => {
            const v = d.vendedor || 'Padrão';
            if (!perf[v]) perf[v] = 0;
            perf[v] += d.valorFaturado;
        });
        const sorted = Object.keys(perf).sort((a,b) => perf[b] - perf[a]);
        this.shadowRoot.getElementById('ranking-container').innerHTML = sorted.map((v, i) => `
            <div style="display:flex; justify-content:space-between; align-items: center; padding: 1.5rem 0; border-bottom:1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap: 15px;">
                    <div style="width: 32px; height: 32px; background: ${i === 0 ? '#0d9488' : '#f1f5f9'}; color: ${i === 0 ? 'white' : '#64748b'}; border-radius: 10px; display: grid; place-items: center; font-weight: 800; font-size: 0.8rem;">
                        ${i+1}
                    </div>
                    <strong>${escapeHTML(v)}</strong>
                </div>
                <span style="font-weight:900; color:#0f172a; font-family: 'Outfit', sans-serif;">${this.formatCurrency(perf[v])}</span>
            </div>
        `).join('');
    }

    renderTable(data = this.reportData) {
        const container = this.shadowRoot.getElementById('table-container');
        let html = `
            <table style="width:100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 1rem; width: 100px;">Nota</th>
                        <th style="padding: 1rem; width: 110px;">Data</th>
                        <th style="padding: 1rem;">Cliente</th>
                        <th style="padding: 1rem;">Vendedor (Editável)</th>
                        <th style="padding: 1rem;">Natureza</th>
                    <th style="padding: 1rem;">Pagamento</th>
                        <th style="padding: 1rem; text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.sort((a,b) => b.dataEmissao.localeCompare(a.dataEmissao)).forEach((d, idx) => {
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; ${d.isCanceled ? 'opacity:0.5; color:red; text-decoration:line-through;' : ''}">
                    <td style="padding: 1rem; width: 100px;"><strong>#${escapeHTML(d.numeroNota)}</strong></td>
                    <td style="padding: 1rem; width: 110px;">${d.dataEmissao.split('-').reverse().join('/')}</td>
                    <td style="padding: 1rem;">
                        <div style="font-weight:700;">${escapeHTML(d.cliente)}</div>
                        <div style="font-size:0.7rem; opacity:0.6;">${escapeHTML(d.filial)}</div>
                    </td>
                    <td style="padding: 1rem;">
                        <select class="edit-vendedor" 
                                data-idx="${this.reportData.indexOf(d)}" 
                                style="padding: 5px 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-family: inherit; width: 100%; cursor: pointer;">
                            <option value="N/A" ${!d.vendedor || d.vendedor === 'N/A' || d.vendedor.includes('XML') ? 'selected' : ''}>-- Atribuir Vendedor --</option>
                            <option value="FELIPE" ${d.vendedor === 'FELIPE' ? 'selected' : ''}>FELIPE</option>
                            <option value="PAULO" ${d.vendedor === 'PAULO' ? 'selected' : ''}>PAULO</option>
                            <option value="JOHN" ${d.vendedor === 'JOHN' ? 'selected' : ''}>JOHN</option>
                            <option value="SARAH" ${d.vendedor === 'SARAH' ? 'selected' : ''}>SARAH</option>
                            <option value="MATHEUS" ${d.vendedor === 'MATHEUS' ? 'selected' : ''}>MATHEUS</option>
                            <option value="JOAO SOUSA" ${d.vendedor === 'JOAO SOUSA' ? 'selected' : ''}>JOÃO SOUSA</option>
                            <option value="JOAO GOMES" ${d.vendedor === 'JOAO GOMES' ? 'selected' : ''}>JOÃO GOMES</option>
                            <option value="WENDEL" ${d.vendedor === 'WENDEL' ? 'selected' : ''}>WENDEL</option>
                            <option value="VINICIUS" ${d.vendedor === 'VINICIUS' ? 'selected' : ''}>VINICIUS</option>
                            <option value="ISAAC" ${d.vendedor === 'ISAAC' ? 'selected' : ''}>ISAAC</option>
                            <option value="BIANCA" ${d.vendedor === 'BIANCA' ? 'selected' : ''}>BIANCA</option>
                            <option value="JONATHAN" ${d.vendedor === 'JONATHAN' ? 'selected' : ''}>JONATHAN</option>
                        </select>
                    </td>
                    <td style="padding: 1rem;">
                        <span style="font-size: 0.7rem; background: #fff7ed; color: #9a3412; padding: 4px 8px; border-radius: 6px; font-weight: 800; border: 1px solid #ffedd5;">
                            ${escapeHTML(d.naturezaOperacao)}
                        </span>
                    </td>
                    <td style="padding: 1rem;">
                        <div style="display:flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                            <span style="font-size: 0.75rem; background: #eff6ff; color: #1e40af; padding: 4px 8px; border-radius: 6px; font-weight: 800; border: 1px solid #dbeafe;">
                                ${escapeHTML(d.formaPagamento)}
                            </span>
                            <span style="font-size: 0.7rem; color: #64748b; font-weight: 700; margin-left: 4px;">
                                ${d.parcelas} Parcelas
                            </span>
                        </div>
                    </td>
                    <td style="padding: 1rem; text-align:right; font-weight:800; font-size: 1.1rem; color: #0d8377;">
                        ${this.formatCurrency(d.valorFaturado)}
                    </td>
                </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;

        // BIND EDIT EVENTS
        container.querySelectorAll('.edit-vendedor').forEach(input => {
            input.addEventListener('change', async (e) => {
                const idx = e.target.getAttribute('data-idx');
                const newVal = e.target.value;
                this.reportData[idx].vendedor = newVal;
                
                this.showToast('Atualizando vendedor...', 'info');
                try {
                    await DatabaseService.syncToSupabase([this.reportData[idx]]);
                    this.showToast('Vendedor atualizado com sucesso!', 'success');
                    // Backup local
                    localStorage.setItem('mci_last_data', JSON.stringify(this.reportData));
                    
                    // ATUALIZAÇÃO EM TEMPO REAL: Recalcula o ranking e KPIs sem dar "pulo" na tela
                    this.updateUI(true);
                } catch (err) {
                    this.showToast('Erro ao sincronizar alteração.', 'error');
                }
            });
        });
    }

    async syncCloud() {
        try {
            this.showToast('Sincronizando...');
            await DatabaseService.syncToSupabase(this.reportData);
            this.showToast('Cloud Sync OK!', 'success');
        } catch (err) { this.showToast('Erro na sincronização.', 'error'); }
    }

    async loadCloud() {
        try {
            // Tenta nuvem primeiro
            this.showToast('Recuperando dados da nuvem...', 'info');
            const data = await DatabaseService.fetchAllHistory();
            if (data && data.length > 0) {
                this.reportData = data;
                localStorage.setItem('mci_last_data', JSON.stringify(data));
                this.showToast('Dados da nuvem restaurados!', 'success');
            } else {
                this.loadFromLocalStorage();
            }
        } catch (err) { 
            console.warn("Erro ao baixar cloud. Usando backup local.");
            this.loadFromLocalStorage();
        }
        this.updateUI();
    }

    loadFromLocalStorage() {
        const local = localStorage.getItem('mci_last_data');
        if (local) {
            this.reportData = JSON.parse(local);
            this.showToast('Backup local carregado (Offline)', 'info');
        }
    }

    loadLocalSettings() {
        const goal = localStorage.getItem('mci_bi_goal');
        if (goal) this.shadowRoot.getElementById('goal-input').value = goal;
    }

    formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }

    showToast(message, type = 'info') {
        const container = this.shadowRoot.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    exportExcel() {
        const headers = ["Nota", "Data", "Cliente", "Filial", "Vendedor", "Valor"];
        const rows = this.reportData.map(d => [d.numeroNota, d.dataEmissao, d.cliente, d.filial, d.vendedor, d.valorFaturado]);
        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `MCI_Export_${Date.now()}.csv`;
        link.click();
    }
}
customElements.define('nfe-report-generator', NfeReportGenerator);
