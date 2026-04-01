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
                    const natOpUpper = naturezaOperacaoRaw.toUpperCase();
                    
                    resolve({
                        filial: getValue(emit, 'xNome') || 'N/A',
                        filialUF: getValue(emit.getElementsByTagName('enderEmit')[0], 'UF') || 'N/A',
                        numeroNota: getValue(ide, 'nNF') || 'N/A',
                        naturezaOperacao: naturezaOperacaoRaw,
                        isRevenue: (natOpUpper.includes('VENDA') || natOpUpper.includes('LOCA')) && !natOpUpper.includes('DEVOLU') && !natOpUpper.includes('RETORNO'),
                        isDemo: natOpUpper.includes('DEMONS'),
                        isDevolucao: natOpUpper.includes('DEVOLU'),
                        isRetorno: natOpUpper.includes('RETORNO'),
                        cliente: getValue(dest, 'xNome') || 'N/A',
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
                        filial: item.filial || 'MCI IMPORT',
                        filialUF: item.estado || 'N/A',
                        numeroNota: item.número_da_nf || item.numeroNota || 'JSON-' + Date.now() + Math.random(),
                        naturezaOperacao: item.tipo_operação || 'Importado via JSON',
                        isRevenue: (item.tipo_operação === 'SAIDA' || item.isRevenue === true),
                        isCanceled: !!item.isCanceled,
                        isDemo: !!item.isDemo,
                        isDevolucao: !!item.isDevolucao,
                        isRetorno: !!item.isRetorno,
                        cliente: item.cliente || 'N/A',
                        cidade: item.cidade || '',
                        estado: item.estado || '',
                        contribuinte: item.contribuinte || 'Sim',
                        frete: item.frete || 'Não',
                        valorFrete: parseFloat(item.valorFrete || 0),
                        difal: parseFloat(item.difal || 0),
                        valorFaturado: parseFloat(item.valor || item.valorFaturado || 0),
                        dataEmissao: item.data_emissão || item.dataEmissao || fallbackDate,
                        vendedor: item.vendedor || 'Padrão (JSON)',
                        formaPagamento: item.forma_de_pagamento || 'Boleto',
                        parcelas: parseInt(item.numero_de_boletos || 1),
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
}

class DatabaseService {
    static async syncToSupabase(data) {
        if (!supabaseClient) throw new Error('Supabase Client indisponível.');

        const validData = data.filter(d => !d.error && !d.isCanceledEvent);
        if (validData.length === 0) return true;

        console.log(`📡 Sincronizando lote de ${validData.length} registros...`);

        // 1. SINCRONIZAÇÃO DE VENDEDORES (Idempotente)
        const vendederesNomes = [...new Set(validData.map(d => d.vendedor))];
        const vResult = await supabaseClient.from('vendedores').upsert(
            vendederesNomes.map(nome => ({ nome })), 
            { onConflict: 'nome' }
        ).select('id, nome');
        
        if (vResult.error) throw new Error(`Erro Vendedores: ${vResult.error.message}`);
        const sellerMap = Object.fromEntries(vResult.data.map(v => [v.nome, v.id]));

        // 2. SINCRONIZAÇÃO DE FILIAIS (Idempotente)
        const filiaisData = [...new Map(validData.map(item => [item.filial, { nome: item.filial, uf: item.filialUF }])).values()];
        const fResult = await supabaseClient.from('filiais').upsert(
            filiaisData, 
            { onConflict: 'nome' }
        ).select('id, nome');

        if (fResult.error) throw new Error(`Erro Filiais: ${fResult.error.message}`);
        const branchMap = Object.fromEntries(fResult.data.map(f => [f.nome, f.id]));

        // 3. SINCRONIZAÇÃO DE FATURAMENTO (Relacional)
        const faturamentoPayload = validData.map(d => ({
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
        }));

        const { error: syncErr } = await supabaseClient
            .from('faturamento')
            .upsert(faturamentoPayload, { onConflict: 'numero_nota' });

        if (syncErr) throw syncErr;
        return true;
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
                :host {
                    display: grid;
                    grid-template-columns: 260px 1fr;
                    grid-template-rows: 100vh;
                    font-family: 'Poppins', sans-serif;
                    background: #f8fafc;
                    overflow: hidden;
                }

                aside {
                    background: #0d8377;
                    color: white;
                    display: flex;
                    flex-direction: column;
                    padding: 2.5rem 1.5rem;
                    z-index: 100;
                    box-shadow: 10px 0 30px rgba(0,0,0,0.05);
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 4rem;
                }

                .brand-logo {
                    width: 44px; height: 44px;
                    background: rgba(255,255,255,0.2);
                    backdrop-filter: blur(10px);
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 900; font-size: 1.4rem;
                    border: 1px solid rgba(255,255,255,0.3);
                }

                nav { display: flex; flex-direction: column; gap: 12px; flex: 1; }

                .nav-item {
                    display: flex; align-items: center; gap: 15px;
                    padding: 15px 20px; border-radius: 16px;
                    color: rgba(255,255,255,0.7); font-weight: 600;
                    cursor: pointer; border: none; background: transparent;
                    transition: all 0.3s; width: 100%; text-align: left;
                }

                .nav-item:hover { background: rgba(255,255,255,0.1); color: white; }
                .nav-item.active { background: white; color: #0d8377; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }

                main { padding: 3.5rem; overflow-y: auto; }

                .view { display: none; animation: slideUp 0.5s ease-out; }
                .view.active { display: block; }

                h1 { font-size: 2.6rem; font-weight: 800; letter-spacing: -1.5px; color: #0f172a; margin: 0 0 0.5rem 0; }
                header p { color: #64748b; font-size: 1.1rem; margin-bottom: 3rem; }

                .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2.5rem; }
                .kpi-card { 
                    background: white; padding: 2rem; border-radius: 28px; 
                    border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }
                .kpi-label { font-size: 0.8rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 1rem; }
                .kpi-value { font-size: 2.2rem; font-weight: 800; color: #0f172a; line-height: 1; margin-bottom: 0.5rem; }
                .kpi-footer { font-size: 0.9rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
                .kpi-footer.up { color: #10b981; }
                .kpi-footer.down { color: #ef4444; }

                .card { background: white; border-radius: 28px; padding: 2.5rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; margin-bottom: 2rem; }
                .card h3 { margin: 0 0 2rem 0; font-size: 1.4rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 12px; }

                .importer-zone {
                    padding: 5rem; border: 3px dashed #cbd5e1; border-radius: 35px;
                    background: #f8fafc; text-align: center; transition: all 0.4s; cursor: pointer;
                }
                .importer-zone:hover { border-color: #0d8377; background: #f0fdfb; transform: scale(1.01); }

                .btn {
                    padding: 16px 32px; border-radius: 18px; font-weight: 700;
                    cursor: pointer; border: none; transition: all 0.2s; font-family: inherit;
                }
                .btn-primary { background: #0d8377; color: white; box-shadow: 0 10px 20px rgba(13, 131, 119, 0.2); }
                .btn-primary:hover { background: #115e59; transform: translateY(-3px); box-shadow: 0 15px 30px rgba(13, 131, 119, 0.3); }

                table { width: 100%; border-collapse: collapse; }
                th { text-align: left; padding: 1.5rem 1rem; background: #f8fafc; color: #64748b; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; border-bottom: 2px solid #f1f5f9; }
                td { padding: 1.5rem 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.95rem; }
                tr:hover td { background: #f9fdfc; }

                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

                .toast-container { position: fixed; bottom: 3rem; right: 3rem; z-index: 1000; }
                .toast { padding: 1.5rem 2.5rem; background: #1e293b; color: white; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 15px; font-weight: 600; margin-top: 1rem; animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
                @keyframes slideIn { from { transform: translateX(150%); } to { transform: translateX(0); } }
            </style>

            <aside>
                <div class="brand">
                    <div class="brand-logo">M</div>
                    <div class="brand-name">MCI Business</div>
                </div>
                
                <div style="margin-bottom: 2rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 16px;">
                    <p style="font-size: 0.7rem; font-weight: 800; opacity: 0.7; margin-bottom: 12px; letter-spacing: 1px;">PERÍODO DE ANÁLISE</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <select id="select-month" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px; border-radius: 8px; font-family: inherit; font-weight: 600;">
                            <option value="01">Jan</option><option value="02">Fev</option><option value="03">Mar</option>
                            <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
                            <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
                            <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
                        </select>
                        <select id="select-year" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px; border-radius: 8px; font-family: inherit; font-weight: 600;">
                            <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                        </select>
                    </div>
                </div>

                <nav>
                    <button class="nav-item active" data-view="dashboard">📊 Dashboard</button>
                    <button class="nav-item" data-view="reports">📋 Relatórios</button>
                    <button class="nav-item" data-view="config">⚙️ Configurações</button>
                </nav>
                <div style="margin-top:auto; font-size: 0.8rem; opacity: 0.6;">MCI Business Intelligence</div>
            </aside>

            <main>
                <div id="view-dashboard" class="view active">
                    <header>
                        <div style="display:flex; justify-content: space-between; align-items: flex-end; width: 100%;">
                            <div>
                                <h1 id="welcome-title">Visão Estratégica</h1>
                                <p id="dashboard-date"></p>
                            </div>
                            <div style="display:flex; gap: 10px;">
                                <button class="btn btn-primary" id="sync-cloud-main-btn" style="padding: 10px 20px; font-size: 0.8rem;">☁️ Sync Cloud</button>
                            </div>
                        </div>
                    </header>

                    <!-- BARRA DE FILTROS ELITE -->
                    <div style="background: white; border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr; gap: 15px; align-items: flex-end; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Busca Rápida (Cliente/Nota)</label>
                            <input type="text" id="filter-search" placeholder="Pesquisar..." style="width:100%; padding: 10px; border: 1.5px solid #f1f5f9; border-radius: 10px; background:#f8fafc; font-family: inherit;">
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Filtrar Vendedor</label>
                            <select id="filter-vendedor" style="width:100%; padding: 10px; border: 1.5px solid #f1f5f9; border-radius: 10px; background:#f8fafc; font-weight: 600;">
                                <option value="">Todos Vendedores</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Filtrar Estado (UF)</label>
                            <select id="filter-estado" style="width:100%; padding: 10px; border: 1.5px solid #f1f5f9; border-radius: 10px; background:#f8fafc; font-weight: 600;">
                                <option value="">Todos os Estados</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Logística (Frete)</label>
                            <select id="filter-frete" style="width:100%; padding: 10px; border: 1.5px solid #f1f5f9; border-radius: 10px; background:#f8fafc; color: #0d8377; font-weight: 800;">
                                <option value="all">Todas Operações</option>
                                <option value="with">Apenas com Frete</option>
                                <option value="without">Frete Grátis/Nulo</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Impostos (Difal)</label>
                            <select id="filter-difal" style="width:100%; padding: 10px; border: 1.5px solid #f1f5f9; border-radius: 10px; background:#f8fafc; color: #3b82f6; font-weight: 800;">
                                <option value="all">Faturamento Total</option>
                                <option value="with">Apenas com DIFAL</option>
                            </select>
                        </div>
                    </div>

                    <div class="kpi-grid">
                        <div class="kpi-card" style="border-top: 4px solid #10b981;">
                            <span class="kpi-label">Faturado Hoje</span>
                            <div class="kpi-value" id="kpi-today">R$ 0,00</div>
                            <div class="kpi-footer" id="kpi-today-sub">Aguardando importação...</div>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Faturamento Mensal</span>
                            <div class="kpi-value" id="kpi-faturado">R$ 0,00</div>
                            <div class="kpi-footer" id="kpi-faturado-sub">Consolidado Real</div>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Atingimento Meta</span>
                            <div class="kpi-value" id="kpi-percentage">0%</div>
                            <div class="kpi-footer" id="kpi-percentage-sub">---</div>
                        </div>
                        <div class="kpi-card">
                            <span class="kpi-label">Projeção Fechamento</span>
                            <div class="kpi-value" id="kpi-forecast">R$ 0,00</div>
                            <div class="kpi-footer" id="kpi-forecast-sub">No ritmo atual</div>
                        </div>
                    </div>

                    <div class="card">
                        <h3>📈 Tendência Diária de Vendas</h3>
                        <div style="height: 400px;"><canvas id="line-chart"></canvas></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div class="card">
                            <h3>🏆 Performance de Vendedores</h3>
                            <div id="ranking-list"></div>
                        </div>
                        <div class="card">
                            <h3>🏢 Representatividade por Unidade</h3>
                            <div style="height: 300px;"><canvas id="pie-chart"></canvas></div>
                        </div>
                    </div>
                </div>

                <div id="view-reports" class="view">
                    <header>
                        <h1>Detalhamento Fiscal</h1>
                        <p>Consolidado de todas as operações ativas no sistema</p>
                    </header>
                    <div class="card">
                        <div style="display: flex; gap: 15px; margin-bottom: 2rem;">
                            <button class="btn btn-primary" id="export-btn">📥 Exportar Dados</button>
                            <button class="btn" style="background:#f1f5f9; color:#475569" id="print-btn">🖨️ PDF/Impressão</button>
                        </div>
                        <div id="table-container"></div>
                    </div>
                </div>

                <div id="view-config" class="view">
                    <header>
                        <h1>Configuração & Importação</h1>
                        <p>Gerenciamento de dados e conexões com a nuvem</p>
                    </header>

                        <div class="card" style="text-align: center;">
                            <h3>📥 Importar Manifestos (XML/JSON)</h3>
                            <div style="margin-bottom: 2rem; display: flex; justify-content: center; gap: 10px;">
                                <div style="text-align: left;">
                                    <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: block;">Mês Destino (JSON/Manual)</label>
                                    <select id="import-month" style="padding: 8px; border-radius: 10px; border: 1px solid #e2e8f0; font-family: inherit;">
                                        <option value="01">Jan</option><option value="02">Fev</option><option value="03">Mar</option>
                                        <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
                                        <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
                                        <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
                                    </select>
                                </div>
                                <div style="text-align: left;">
                                    <label style="font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 4px; display: block;">Ano Destino</label>
                                    <select id="import-year" style="padding: 8px; border-radius: 10px; border: 1px solid #e2e8f0; font-family: inherit;">
                                        <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                                    </select>
                                </div>
                            </div>
                            <div class="importer-zone" id="drop-zone">
                                <div style="font-size: 3rem; margin-bottom: 1.5rem;">📂</div>
                                <p style="font-size: 1.2rem; font-weight: 700; margin-bottom: 2rem;">Arraste aqui os arquivos de <span style="color:#0d8377">Março</span> ou clique para selecionar</p>
                                <button class="btn btn-primary" id="select-btn">Selecionar Arquivos</button>
                                <input type="file" id="file-input" multiple style="display:none">
                            </div>
                        </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div class="card">
                            <h3>☁️ Nuvem Supabase</h3>
                            <button class="btn btn-primary" id="sync-btn" style="width:100%; margin-bottom: 1rem;">🔄 Sincronizar Tudo com Cloud</button>
                            <button class="btn" id="load-btn" style="width:100%; background:#f1f5f9; color:#0d8377; border:1px solid #e2e8f0;">☁️ Restaurar do Banco Remoto</button>
                        </div>
                        <div class="card">
                            <h3>🎯 Meta de Faturamento</h3>
                            <input type="number" id="goal-input" style="width:100%; padding: 18px; border: 2px solid #e2e8f0; border-radius: 18px; font-size: 1.4rem; font-weight: 800;" placeholder="R$ 0,00">
                            <p style="margin-top: 1rem; color: #64748b; font-size: 0.9rem;">Meta usada para cálculo de projeção e atingimento.</p>
                        </div>
                    </div>
                </div>
            </main>
            <div class="toast-container" id="toast-container"></div>
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
        const filters = ['filter-search', 'filter-vendedor', 'filter-estado', 'filter-frete', 'filter-difal'];
        filters.forEach(id => {
            const el = shadow.getElementById(id);
            if (el) {
                const event = el.tagName === 'INPUT' ? 'input' : 'change';
                el.addEventListener(event, () => this.updateUI());
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

    updateUI() {
        const shadow = this.shadowRoot;
        const selMonth = shadow.getElementById('select-month').value;
        const selYear = shadow.getElementById('select-year').value;
        const periodKey = `${selYear}-${selMonth}`;

        const searchText = shadow.getElementById('filter-search').value.toLowerCase();
        const filtVendedor = shadow.getElementById('filter-vendedor').value;
        const filtEstado = shadow.getElementById('filter-estado').value;
        const filtFrete = shadow.getElementById('filter-frete').value;
        const filtDifal = shadow.getElementById('filter-difal').value;

        // MULTI-LAYER FILTER LOGIC
        const rawPeriodData = this.reportData.filter(d => d && d.dataEmissao && d.dataEmissao.startsWith(periodKey));
        
        // Update Filters Dynamic Content (Vendors/States for the period)
        this.populateDynamicFilters(rawPeriodData);

        const filteredData = rawPeriodData.filter(d => {
            const matchesSearch = !searchText || (d.cliente.toLowerCase().includes(searchText) || d.numeroNota.includes(searchText));
            const matchesVendedor = !filtVendedor || d.vendedor === filtVendedor;
            const matchesEstado = !filtEstado || d.estado === filtEstado;
            const matchesFrete = filtFrete === 'all' || (filtFrete === 'with' ? d.valorFrete > 0 : d.valorFrete === 0);
            const matchesDifal = filtDifal === 'all' || (filtDifal === 'with' ? (d.difal > 0) : true);
            return matchesSearch && matchesVendedor && matchesEstado && matchesFrete && matchesDifal;
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

        if (this.currentView === 'dashboard') {
            this.renderCharts(billed);
            this.renderRanking(billed);
        } else if (this.currentView === 'reports') {
            this.renderTable(filteredData);
        }
    }

    populateDynamicFilters(data) {
        const shadow = this.shadowRoot;
        const vSelect = shadow.getElementById('filter-vendedor');
        const eSelect = shadow.getElementById('filter-estado');
        
        const currentV = vSelect.value;
        const currentE = eSelect.value;

        const vendedores = [...new Set(data.map(d => d.vendedor))].sort();
        const estados = [...new Set(data.map(d => d.estado))].filter(Boolean).sort();

        // Prevent wiping while typing
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
        
        const ctxLine = shadow.getElementById('line-chart').getContext('2d');
        if (this.lineChart) this.lineChart.destroy();
        this.lineChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: dates.map(d => d.split('-').reverse().join('/')),
                datasets: [{
                    label: 'Faturamento',
                    data: dates.map(d => daily[d]),
                    borderColor: '#0d8377',
                    backgroundColor: 'rgba(13, 131, 119, 0.1)',
                    fill: true, tension: 0.4, borderWidth: 4
                }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });

        // Pie
        const branches = {};
        data.forEach(d => { branches[d.filial] = (branches[d.filial] || 0) + d.valorFaturado; });
        const ctxPie = shadow.getElementById('pie-chart').getContext('2d');
        if (this.pieChart) this.pieChart.destroy();
        this.pieChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: Object.keys(branches),
                datasets: [{
                    data: Object.values(branches),
                    backgroundColor: ['#0d8377', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']
                }]
            },
            options: { maintainAspectRatio: false, cutout: '70%' }
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
        this.shadowRoot.getElementById('ranking-list').innerHTML = sorted.map((v, i) => `
            <div style="display:flex; justify-content:space-between; padding: 1.2rem 0; border-bottom:1px solid #f1f5f9;">
                <span>${i+1}. <strong>${escapeHTML(v)}</strong></span>
                <span style="font-weight:800; color:#0d8377;">${this.formatCurrency(perf[v])}</span>
            </div>
        `).join('');
    }

    renderTable(data = this.reportData) {
        const container = this.shadowRoot.getElementById('table-container');
        let html = '<table><thead><tr><th>Nota</th><th>Data</th><th>Cliente</th><th>Filial</th><th>Vendedor</th><th style="text-align:right;">Valor</th></tr></thead><tbody>';
        data.sort((a,b) => b.dataEmissao.localeCompare(a.dataEmissao)).forEach(d => {
            html += `<tr style="${d.isCanceled ? 'opacity:0.5; text-decoration:line-through; color:red;' : ''}">
                <td><strong>#${escapeHTML(d.numeroNota)}</strong></td>
                <td>${d.dataEmissao.split('-').reverse().join('/')}</td>
                <td>${escapeHTML(d.cliente)}</td>
                <td>${escapeHTML(d.filial)}</td>
                <td>${escapeHTML(d.vendedor)}</td>
                <td style="text-align:right; font-weight:800;">${this.formatCurrency(d.valorFaturado)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
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
