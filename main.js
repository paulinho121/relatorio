// --- SUPABASE CONFIG ---
const SUPABASE_URL = "https://sjimfrvggujbarxedplu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaW1mcnZnZ3VqYmFyeGVkcGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjQxMDcsImV4cCI6MjA4ODY0MDEwN30.xL39Ku8lZuTsvxsUhyBj_iEV721ASMG2gVjUxyG1H3E";

// Failsafe initialization
let supabaseClient = null;
if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// --- UTILS & SERVICES ---

// 🌐 THREE.JS DOTTED SURFACE COMPONENT
class DottedSurface extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.initThree();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    position: fixed;
                    inset: 0;
                    z-index: -1;
                    pointer-events: none;
                    background: var(--bg);
                }
                #container { width: 100%; height: 100%; opacity: 0.8; }
            </style>
            <div id="container"></div>
        `;
    }

    initThree() {
        if (!window.THREE) return;
        const container = this.shadowRoot.getElementById('container');
        const SEPARATION = 150;
        const AMOUNTX = 40;
        const AMOUNTY = 60;

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0xf9f9fa, 2000, 10000);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
        camera.position.set(0, 355, 1220);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0); 
        container.appendChild(renderer.domElement);

        const positions = [];
        const colors = [];
        const geometry = new THREE.BufferGeometry();

        for (let ix = 0; ix < AMOUNTX; ix++) {
            for (let iy = 0; iy < AMOUNTY; iy++) {
                const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
                const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
                positions.push(x, 0, z);
                // Verde Google: #34a85a (partículas em escala normalizada para Three.js)
                colors.push(0.2, 0.65, 0.35); 
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 6,
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        let count = 0;
        const animate = () => {
            if (!this.isConnected) return;
            this._animId = requestAnimationFrame(animate);
            const posAttr = geometry.attributes.position;
            const posArray = posAttr.array;
            let i = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    const idx = i * 3;
                    posArray[idx + 1] = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;
                    i++;
                }
            }
            posAttr.needsUpdate = true;
            renderer.render(scene, camera);
            count += 0.05;
        };

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);
        animate();

        this._cleanup = () => {
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(this._animId);
            renderer.dispose();
            geometry.dispose();
            material.dispose();
        };
    }

    disconnectedCallback() {
        if (this._cleanup) this._cleanup();
    }
}
customElements.define('dotted-surface', DottedSurface);

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
                    const isExit = getValue(ide, 'tpNF') === '1';
                    const indIEDest = getValue(dest, 'indIEDest');
                    const isContribuinte = indIEDest === '1';
                    
                    const cnpjEmit = getValue(emit, 'CNPJ');
                    const cnpjDest = getValue(dest, 'CNPJ');
                    let branchName = getValue(emit, 'xNome') || 'N/A';
                    
                    // Lógica inteligente de identificação de filial (Emitente ou Destinatário)
                    const myCnpjs = {
                        '05502390000111': 'MATRIZ (CE)',
                        '05502390000200': 'FILIAL (SC)',
                        '05502390000383': 'FILIAL (SP)'
                    };
                    
                    // Sanitização de CNPJ (Remove tudo o que não for número)
                    const cleanCnpj = (val) => String(val || "").replace(/\D/g, "");
                    const cnpjEmitClean = cleanCnpj(cnpjEmit);
                    const cnpjDestClean = cleanCnpj(cnpjDest);

                    if (myCnpjs[cnpjEmitClean]) {
                        branchName = myCnpjs[cnpjEmitClean];
                    } else if (myCnpjs[cnpjDestClean]) {
                        branchName = myCnpjs[cnpjDestClean];
                    }

                    let natureType = 'OUTROS';

                    // NOVO MAPEAMENTO DE NATUREZA (Prioriza filtros de não-receita primeiro)
                    if (natOpUpper.includes('RETORNO')) {
                        natureType = natOpUpper.includes('LOCA') ? 'RETORNO DE LOCAÇÃO' : 'RETORNO';
                    } else if (natOpUpper.includes('DEVOLU')) {
                        natureType = 'DEVOLUÇÃO';
                    } else if (natOpUpper.includes('AMOSTRA') || natOpUpper.includes('BRINDE') || natOpUpper.includes('BONIF')) {
                        natureType = 'AMOSTRA/BRINDE';
                    } else if (natOpUpper.includes('TRANSF') || natOpUpper.includes('REMESSA P/ FILIAL')) {
                        natureType = 'TRANSFERÊNCIA';
                    } else if (natOpUpper.includes('VENDA')) {
                        natureType = isContribuinte ? 'VENDAS CONTRIBUINTES' : 'VENDAS NÃO CONTRIBUINTES';
                    } else if (natOpUpper.includes('LOCA') || natOpUpper.includes('ALUG')) {
                        natureType = 'SAÍDA DE LOCAÇÃO';
                    }


                    // CÁLCULO ROBUSTO DE DIFAL/TAXAS
                    let vDifal = parseFloat(getValue(ICMSTot, 'vICMSUFDest') || 0) + parseFloat(getValue(ICMSTot, 'vFCPUFDest') || 0);
                    
                    // Se o totalizador estiver zerado, busca nos itens (det)
                    if (vDifal === 0) {
                        const items = infNFe.getElementsByTagName('det');
                        for (let i = 0; i < items.length; i++) {
                            const icmsuf = items[i].getElementsByTagName('ICMSUFDest')[0];
                            if (icmsuf) {
                                vDifal += parseFloat(getValue(icmsuf, 'vICMSUFDest') || 0);
                                vDifal += parseFloat(getValue(icmsuf, 'vFCPUFDest') || 0);
                            }
                        }
                    }

                    resolve({
                        filial: branchName,
                        filialUF: getValue(emit.getElementsByTagName('enderEmit')[0], 'UF') || 'N/A',
                        numeroNota: getValue(ide, 'nNF') || 'N/A',
                        naturezaOperacao: natureType,
                        naturezaOriginal: natOpUpper,
                        isRevenue: isExit && ['VENDAS CONTRIBUINTES', 'VENDAS NÃO CONTRIBUINTES', 'SAÍDA DE LOCAÇÃO'].includes(natureType),
                        isDemo: natureType === 'AMOSTRA/BRINDE',
                        isDevolucao: natureType === 'DEVOLUÇÃO',
                        isRetorno: natureType === 'RETORNO',
                        isExit: isExit,
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
                        difal: vDifal,
                        valorFaturado: parseFloat(getValue(ICMSTot, 'vNF') || 0),
                        dataEmissao: getValue(ide, 'dhEmi')?.substring(0, 10) || new Date().toISOString().substring(0, 10),
                        vendedor: (() => {
                            const infAdic = nfeNode.getElementsByTagName('infAdic')[0];
                            const infCpl = getValue(infAdic, 'infCpl') || '';
                            const infAdFisco = getValue(infAdic, 'infAdFisco') || '';
                            const allInfo = (infCpl + ' ' + infAdFisco).toUpperCase();
                            
                            const matches = [
                                /VENDEDOR[:\-\s]+([A-Z\sÀ-Ú]+)/i,
                                /VEND[:\-\s]+([A-Z\sÀ-Ú]+)/i,
                                /REP[:\-\s]+([A-Z\sÀ-Ú]+)/i
                            ];
                            
                            for (const regex of matches) {
                                const match = allInfo.match(regex);
                                if (match && match[1]) return match[1].trim().split('\n')[0].substring(0, 20);
                            }
                            return 'NAO ATRIBUIDO';
                        })(),
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

            // LOGICA DE RECEITA EXCLUSIVA (Conforme pedido)
            const isRevenue = ['VENDAS CONTRIBUINTES', 'VENDAS NÃO CONTRIBUINTES', 'SAÍDA DE LOCAÇÃO', 'SAIDA', 'LOCAÇÃO','VENDA'].some(t => natureza.toUpperCase().includes(t));
            let natureNameFixed = natureza.toUpperCase();
            if (natureNameFixed === 'VENDA' || natureNameFixed === 'SAIDA') natureNameFixed = 'VENDAS CONTRIBUINTES';
            if (natureNameFixed === 'LOCAÇÃO') natureNameFixed = 'SAÍDA DE LOCAÇÃO';

            if (valor !== 0 || nota) {
                results.push({
                    filial: estado || 'MCI IMPORT',
                    filialUF: estado || 'N/A',
                    numeroNota: nota || 'PASTE-' + Date.now() + Math.random(),
                    naturezaOperacao: natureNameFixed,
                    isRevenue: isRevenue,
                    isCanceled: natureza.includes('CANCELADA') || natureza.includes('DEVOLUÇÃO'),
                    isExit: true, // No importar via texto, assume-se saída (venda) por padrão
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
        this.drilldownFilter = null; // Para filtros via cliques em gráficos (ex: vendedor)
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Outfit:wght@400;700;900&display=swap');

                :host {
                    --primary: #34a85a;
                    --secondary: #6495ed;
                    --accent: #66d9ef;
                    --bg: #f9f9fa;
                    --sidebar: #f9f9fa;
                    --foreground: #333333;
                    --card: #ffffff;
                    --border: #d4d4d4;
                    --muted: #6e6e6e;
                    --radius: 0.5rem;
                    --panel: rgba(255, 255, 255, 0.8);
                    --noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                .app-container {
                    display: grid;
                    grid-template-areas: "sidebar content";
                    grid-template-columns: 240px 1fr;
                    grid-template-rows: 100vh;
                    height: 100vh;
                    background-color: var(--bg);
                    background-image: var(--noise);
                    background-blend-mode: overlay;
                    font-family: 'Inter', sans-serif;
                    overflow: hidden;
                    position: relative;
                    transition: grid-template-columns 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @media (max-width: 1024px) {
                    .app-container {
                        grid-template-areas: "mobile-header" "content";
                        grid-template-columns: 1fr;
                        grid-template-rows: auto 1fr;
                    }
                    .sidebar-collapse-btn { display: none !important; }
                }
                
                .app-container.sidebar-collapsed {
                    grid-template-columns: 80px 1fr;
                }

                aside { 
                    grid-area: sidebar; 
                    z-index: 300; 
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
                    background: var(--sidebar);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    padding: 2rem 1.2rem;
                    position: relative;
                }

                @media (max-width: 1024px) {
                    aside {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 280px;
                        height: 100vh;
                        transform: translateX(-100%);
                        box-shadow: 20px 0 50px rgba(0,0,0,0.1);
                        padding: 1.5rem;
                    }
                    aside.open { transform: translateX(0); }
                }
                
                .sidebar-collapsed aside { padding: 2rem 0.6rem; }
                
                .sidebar-collapsed .brand-zone h1,
                .sidebar-collapsed .brand-zone p,
                .sidebar-collapsed .nav-item span,
                .sidebar-collapsed .sidebar-footer-info,
                .sidebar-collapsed .fiscal-period-label {
                    display: none;
                }

                .sidebar-collapse-btn {
                    position: absolute;
                    right: -12px;
                    top: 24px;
                    width: 24px;
                    height: 24px;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    z-index: 301;
                    transition: transform 0.3s;
                }
                .sidebar-collapsed .sidebar-collapse-btn { transform: rotate(180deg); }

                main { grid-area: content; overflow-y: auto; padding: 2rem; position: relative; }

                @media (max-width: 1024px) {
                    .app-container {
                        grid-template-areas: "mobile-header" "content";
                        grid-template-columns: 1fr;
                        grid-template-rows: auto 1fr;
                    }
                    aside { grid-area: content; }
                    main { grid-area: content; padding: 1rem; }
                    .mobile-header { grid-area: mobile-header; display: flex; }
                }

                /* MOBILE HEADER */
                .mobile-header {
                    display: none;
                    background: var(--sidebar);
                    color: var(--foreground);
                    padding: 1rem 1.5rem;
                    align-items: center;
                    justify-content: space-between;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    border-bottom: 1px solid var(--border);
                }

                .menu-toggle {
                    background: transparent;
                    border: none;
                    color: var(--foreground);
                    font-size: 1.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* SIDEBAR LUXURY */
                aside {
                    background: var(--sidebar);
                    color: var(--foreground);
                    padding: 2rem 1.2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    border-right: 1px solid var(--border);
                    z-index: 200;
                    position: relative;
                }

                @media (max-width: 1024px) {
                    aside {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 280px;
                        height: 100vh;
                        transform: translateX(-100%);
                    }
                    aside.open {
                        transform: translateX(0);
                    }
                    .overlay {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(0,0,0,0.5);
                        backdrop-filter: blur(4px);
                        z-index: 150;
                    }
                    .overlay.open { display: block; }
                }

                .brand-zone {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 2rem;
                }

                .brand-logo {
                    width: 48px; height: 48px;
                    background: linear-gradient(135deg, var(--primary) 0%, #4caf50 100%);
                    border-radius: 16px;
                    display: grid; place-items: center;
                    font-family: 'Outfit', sans-serif;
                    font-weight: 900; font-size: 1.5rem;
                    box-shadow: 0 10px 20px rgba(52, 168, 90, 0.3);
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
                    color: var(--muted);
                    border: 1px solid transparent;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                    font-size: 0.9rem;
                    white-space: nowrap;
                }
                .sidebar-collapsed .nav-item { justify-content: center; padding: 16px 12px; }

                .nav-item:hover { background: rgba(52, 168, 90, 0.05); color: var(--primary); transform: translateX(5px); }
                .nav-item.active { 
                    background: #eef7f1; 
                    color: var(--primary); 
                    border: 1px solid #d8eadc;
                    box-shadow: 0 4px 12px rgba(52, 168, 90, 0.1);
                    position: relative;
                }
                .nav-item.active::after {
                    content: ''; position: absolute; left: -10px; width: 4px; height: 24px; background: var(--primary); border-radius: 10px; box-shadow: 0 0 15px var(--primary);
                }

                /* MAIN SURFACE */
                main {
                    padding: 2rem;
                    overflow-y: auto;
                    position: relative;
                    scroll-behavior: smooth;
                    background: radial-gradient(circle at top right, rgba(52, 168, 90, 0.03) 0%, transparent 40%);
                }

                @media (max-width: 640px) {
                    main { padding: 1rem; }
                }

                .view { display: none; max-width: 1400px; margin: 0 auto; }
                .view.active { display: block; animation: viewEnter 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

                /* GLOBAL FILTER BAR RESPONSIVE */
                .global-filter-bar {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 12px;
                    align-items: flex-end;
                    padding: 1.2rem;
                    margin-bottom: 2rem;
                }

                @media (max-width: 768px) {
                    .global-filter-bar {
                        grid-template-columns: 1fr 1fr;
                    }
                    .global-filter-bar > div:first-child { grid-column: span 2; }
                }

                @media (max-width: 480px) {
                    .global-filter-bar {
                        grid-template-columns: 1fr;
                    }
                    .global-filter-bar > div:first-child { grid-column: span 1; }
                }

                @keyframes viewEnter {
                    from { transform: translateY(40px); opacity: 0; filter: blur(10px); }
                    to { transform: translateY(0); opacity: 1; filter: blur(0); }
                }

                h1 { font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 900; color: #0f172a; letter-spacing: -1.5px; line-height: 1.1; margin-bottom: 0.5rem; }
                header { margin-bottom: 2rem; }
                .header-content { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; }
                @media (max-width: 640px) {
                    .header-content { flex-direction: column; align-items: flex-start; }
                }
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
                }

                @media (max-width: 640px) {
                    .glass-card { padding: 1rem; border-radius: 16px; margin-bottom: 1rem; }
                }
                }

                .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
                
                .operation-center { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr 1fr; 
                    gap: 1.2rem; 
                    margin-bottom: 2.5rem; 
                }
                @media (max-width: 900px) { .operation-center { grid-template-columns: 1fr; } }

                .chart-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 2rem; margin-bottom: 2.5rem; align-items: start; }
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
                
                .command-center {
                    display: grid;
                    grid-template-columns: 2fr 1.2fr;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                @media (max-width: 1024px) {
                    .command-center { grid-template-columns: 1fr; }
                }

                .operation-center {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .chart-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                @media (max-width: 1024px) {
                    .chart-grid { grid-template-columns: 1fr; }
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
                .table-wrapper { 
                    background: white; 
                    border-radius: 24px; 
                    border: 1px solid var(--border); 
                    overflow: auto; 
                    max-height: 800px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.02);
                }
                table { width: 100%; border-collapse: separate; border-spacing: 0; }
                thead { position: sticky; top: 0; z-index: 50; }
                th { 
                    background: #f8fafc; color: #64748b; font-size: 0.7rem; font-weight: 800; 
                    text-transform: uppercase; letter-spacing: 1px; padding: 1.2rem; border-bottom: 1px solid var(--border); 
                }
                td { background: white; padding: 1rem 1.2rem; border-bottom: 1px solid #f1f5f9; transition: all 0.3s; font-size: 0.85rem; }
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
                <dotted-surface></dotted-surface>
                <div class="overlay" id="sidebar-overlay"></div>
                
                <div class="mobile-header">
                    <div style="display:flex; align-items:center; gap: 12px;">
                        <div class="brand-logo" style="width:32px; height:32px; font-size:1rem; border-radius:8px;">M</div>
                        <span style="font-family: 'Outfit', sans-serif; font-weight:900; font-size:1.1rem; letter-spacing:-0.5px;">MCI Intelligence</span>
                    </div>
                    <button class="menu-toggle" id="menu-toggle">☰</button>
                </div>

                <aside id="app-sidebar">
                    <button class="sidebar-collapse-btn" id="sidebar-toggle">❮</button>
                    
                    <div class="brand-zone" style="display:flex; align-items:center; gap:12px;">
                        <div class="brand-logo" style="flex-shrink:0;">M</div>
                        <div>
                            <h1 style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.2rem; letter-spacing: -1px; margin:0;">MCI Intel</h1>
                            <p style="font-size: 0.5rem; text-transform: uppercase; letter-spacing: 1px; color: #475569; font-weight: 900; margin:0;">Elite Platform</p>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem; padding: 1.2rem; background: rgba(0,0,0,0.02); border-radius: 20px; border: 1px solid rgba(0,0,0,0.05);">
                        <p class="fiscal-period-label" style="font-size: 0.6rem; font-weight: 900; color: #475569; margin-bottom: 10px; letter-spacing: 1px; text-transform: uppercase;">Período</p>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <select id="select-month" style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.75rem;">
                                <option value="01">Jan</option><option value="02">Fev</option><option value="03" selected>Mar</option>
                                <option value="04">Abr</option><option value="05">Mai</option><option value="06">Jun</option>
                                <option value="07">Jul</option><option value="08">Ago</option><option value="09">Set</option>
                                <option value="10">Out</option><option value="11">Nov</option><option value="12">Dez</option>
                            </select>
                            <select id="select-year" style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.75rem;">
                                <option value="2024">2024</option><option value="2025">2025</option><option value="2026" selected>2026</option>
                            </select>
                        </div>
                    </div>

                    <nav style="display:flex; flex-direction:column; gap:8px;">
                        <button class="nav-item active" data-view="dashboard" title="Dashboard"><i>🏠</i> <span>Dashboard Elite</span></button>
                        <button class="nav-item" data-view="reports" title="Auditoria"><i>📑</i> <span>Auditoria Fiscal</span></button>
                        <button class="nav-item" data-view="config" title="Controladoria"><i>⚙️</i> <span>Controladoria</span></button>
                    </nav>

                    <div style="margin-top: auto; padding-top: 2rem;">
                        <div class="sidebar-footer-info" style="font-size: 0.7rem; color: #475569; font-weight: 800; margin-bottom: 8px;">SYSTÉM STATUS</div>
                        <div style="display:flex; align-items: center; gap: 10px; justify-content: center;">
                            <div style="width: 10px; height: 10px; background: #2dd4bf; border-radius: 50%; box-shadow: 0 0 10px #2dd4bf; flex-shrink:0;"></div>
                            <span class="sidebar-footer-info" style="font-size: 0.75rem; font-weight: 700; color: #64748b;">Nuvem Ativa</span>
                        </div>
                    </div>
                </aside>

                <main>
                    <header>
                        <div class="header-content">
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
                    <div class="glass-card global-filter-bar" id="global-filter-zone">
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
                                <option value="VENDAS CONTRIBUINTES">Vendas Contribuintes</option>
                                <option value="VENDAS NÃO CONTRIBUINTES">Vendas Não Contribuintes</option>
                                <option value="SAÍDA DE LOCAÇÃO">Saída de Locação</option>
                                <option value="TRANSFERENCIA">Transferência</option>
                                <option value="BRINDE">Amostras/Brindes</option>
                                <option value="DEVOLUÇÃO">Devolução / Estorno</option>
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
                            <label style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Logística</label>
                            <select id="filter-frete" style="width:100%; border-color: #ccfbf1; background: #f0fdfa;">
                                <option value="all">Filtro Frete</option>
                                <option value="with">Com Valor Frete</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 6px; display: block; text-transform: uppercase;">Fiscal (DIFAL)</label>
                            <select id="filter-difal" style="width:100%; border-color: #dbeafe; background: #eff6ff;">
                                <option value="all">Filtro Impostos</option>
                                <option value="with">Somente com DIFAL</option>
                            </select>
                        </div>
                    </div>

                    <div id="view-dashboard" class="view active">

                        <!-- ELITE KPI PERFORMANCE SUITE (SINGLE ROW) -->
                        <div class="elite-kpi-suite" style="display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr 1.5fr; gap: 12px; margin-bottom: 2rem;">
                            <!-- FATURADO -->
                            <div class="kpi-stat" style="background: linear-gradient(135deg, var(--primary) 0%, #2e8b57 100%); color: white; min-height: 100px; justify-content: center; padding: 1rem; border:none;">
                                <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                                    <span style="font-size: 0.55rem; font-weight: 900; opacity: 0.8; text-transform: uppercase;">Faturado Mês</span>
                                    <div id="kpi-pacing-indicator" style="background: rgba(255,255,255,0.2); width: 8px; height: 8px; border-radius: 50%;"></div>
                                </div>
                                <div id="kpi-faturado" style="font-size: 1.6rem; font-weight: 900; font-family: 'Outfit', sans-serif;">R$ 0,00</div>
                                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                    <div style="background: rgba(255,255,255,0.2); flex: 1; height: 4px; border-radius: 10px; overflow: hidden;">
                                        <div id="kpi-progress-bar" style="height: 100%; background: #ffffff; width: 0%;"></div>
                                    </div>
                                    <span style="font-size: 0.65rem; font-weight: 900;" id="kpi-percentage">0%</span>
                                </div>
                            </div>

                            <!-- PROJEÇÃO -->
                            <div class="kpi-stat" style="padding: 12px 15px; border-left: 4px solid var(--secondary); background: white; min-height: 100px;">
                                <span style="font-size: 0.55rem; font-weight: 900; color: #64748b; text-transform: uppercase;">Projeção Final</span>
                                <div id="kpi-forecast" style="font-size: 1.4rem; font-weight: 900; color: var(--secondary); margin: 2px 0;">R$ 0,00</div>
                                <div id="kpi-forecast-sub" style="font-size: 0.5rem; font-weight: 800; color: #94a3b8;">Tendência Mensal</div>
                            </div>

                            <!-- HOJE -->
                            <div class="kpi-stat" style="padding: 12px 15px; background: white; min-height: 100px;">
                                <span style="font-size: 0.55rem; font-weight: 900; color: #64748b; text-transform: uppercase;">Faturado Hoje</span>
                                <div id="kpi-today" style="font-size: 1.1rem; font-weight: 900; color: #0f172a; margin-top: 5px;">R$ 0,00</div>
                                <div style="font-size: 0.5rem; margin-top: auto; color: #34a85a; font-weight: 800;">Realtime 💰</div>
                            </div>

                            <!-- VELOCIDADE -->
                            <div class="kpi-stat" style="padding: 12px 15px; background: white; min-height: 100px;">
                                <span style="font-size: 0.55rem; font-weight: 900; color: #64748b; text-transform: uppercase;">Média Diária</span>
                                <div id="kpi-velocity-daily" style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-top: 5px;">R$ 0/dia</div>
                                <div style="font-size: 0.5rem; margin-top: auto; color: var(--secondary); font-weight: 800;">Velocidade ⚡</div>
                            </div>

                            <!-- IMPOSTOS -->
                            <div class="kpi-stat" style="padding: 12px 15px; background: #f8fafc; border: 1px dashed #e2e8f0; min-height: 100px;">
                                <span style="font-size: 0.55rem; font-weight: 900; color: #64748b; text-transform: uppercase;">Fisco & Logística</span>
                                <div style="margin-top: 5px; display:flex; flex-direction:column; gap:2px;">
                                    <div style="font-size: 0.7rem; font-weight: 800; color: #0d9488;">F: <span id="kpi-frete">R$ 0,00</span></div>
                                    <div style="font-size: 0.7rem; font-weight: 800; color: #3b82f6;">D: <span id="kpi-difal">R$ 0,00</span></div>
                                </div>
                            </div>
                        </div>

                        <!-- DATA VISUALIZATION (LEVEL 3) -->
                        <div id="drilldown-alert" style="display:none; background: #eef7f1; color: var(--primary); padding: 12px 20px; border-radius: 12px; margin-bottom: 1.5rem; font-weight: 800; justify-content: space-between; align-items: center; border: 1px solid #d8eadc;">
                            <span>🏆 Visualizando filtro de vendedor: <span id="drilldown-name"></span></span>
                            <button id="clear-drilldown" class="btn" style="padding: 4px 10px; font-size: 0.7rem; background: var(--primary); color: white;">Limpar Filtro ✖</button>
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

                        <!-- DATA CENTER (Restauração de Importação) -->
                        <div class="glass-card" style="margin-top: 2rem; border: 2px dashed var(--border); background: rgba(255,255,255,0.4);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                                <h3 style="margin:0;">📥 Central de Dados (Importar XML)</h3>
                                <div style="font-size:0.7rem; font-weight:800; color:var(--primary);">Suporta Multi-XML / Paste</div>
                            </div>
                            <textarea id="import-xml-paste" placeholder="Cole o conteúdo de um XML aqui ou arraste arquivos para o navegador..." style="width:100%; height:80px; margin-bottom: 1rem; border-radius: 12px; border: 1.5px solid var(--border); padding: 15px; font-family: monospace; font-size: 0.7rem;"></textarea>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                                <button class="btn btn-primary" id="btn-process-paste">Processar XML Colado 🚀</button>
                                <button class="btn" style="background:white; border: 1px solid var(--border);" onclick="document.getElementById('xml-input').click()">📁 Selecionar Arquivos XML</button>
                            </div>
                            <input type="file" id="xml-input" multiple accept=".xml" style="display:none">
                        </div>

                        <div class="glass-card" style="margin-bottom: 2rem;">
                            <h3>📊 Evolução Mensal Estratégica (BI)</h3>
                            <div style="height: 300px; position: relative;">
                                <canvas id="evolutionChart"></canvas>
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
        const shadow = this.shadowRoot;
        const navs = shadow.querySelectorAll('.nav-item');
        const views = shadow.querySelectorAll('.view');
        const sidebar = shadow.getElementById('app-sidebar');
        const overlay = shadow.getElementById('sidebar-overlay');
        const menuToggle = shadow.getElementById('menu-toggle');
        const toggleBtn = shadow.getElementById('sidebar-toggle');
        const container = shadow.querySelector('.app-container');

        // SIDEBAR COLLAPSE LOGIC (DESKTOP)
        if (toggleBtn && container) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = container.classList.toggle('sidebar-collapsed');
                localStorage.setItem('mci_sidebar_collapsed', isCollapsed);
            });
            
            // Restore state
            if (localStorage.getItem('mci_sidebar_collapsed') === 'true') {
                container.classList.add('sidebar-collapsed');
            }
        }

        const closeSidebar = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        };

        const openSidebar = () => {
            sidebar.classList.add('open');
            overlay.classList.add('open');
        };

        if (menuToggle) menuToggle.addEventListener('click', openSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);

        navs.forEach(nav => {
            nav.addEventListener('click', () => {
                const target = nav.dataset.view;
                navs.forEach(n => n.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                nav.classList.add('active');
                shadow.getElementById(`view-${target}`).classList.add('active');
                this.currentView = target;
                
                const welcomeTitle = shadow.getElementById('welcome-title');
                if (welcomeTitle) {
                    if (target === 'dashboard') welcomeTitle.textContent = 'Visão Estratégica';
                    else if (target === 'reports') welcomeTitle.textContent = 'Auditoria Fiscal';
                    else if (target === 'config') welcomeTitle.textContent = 'Configurações de BI';
                }

                // Update visibility of the global filter bar
                const filterBar = shadow.getElementById('global-filter-zone');
                if (filterBar) {
                    filterBar.style.display = (target === 'config') ? 'none' : 'grid';
                }

                closeSidebar();
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
                el.addEventListener(event, () => {
                    this.drilldownFilter = null; // Reseta drilldown se usuário mudar filtros globais
                    this.updateUI();
                });
            }
        });

        shadow.getElementById('clear-drilldown').addEventListener('click', () => {
            this.drilldownFilter = null;
            this.updateUI();
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

        // APLICAR DRILLDOWN SE EXISTIR
        const alert = shadow.getElementById('drilldown-alert');
        if (this.drilldownFilter) {
            alert.style.display = 'flex';
            shadow.getElementById('drilldown-name').textContent = this.drilldownFilter.value;
        } else {
            alert.style.display = 'none';
        }

        const filteredData = rawPeriodData.filter(d => {
            const matchesSearch = !filtSearch || (d.cliente.toLowerCase().includes(filtSearch) || d.numeroNota.includes(filtSearch));
            const matchesFilial = !filtFilial || d.filial === filtFilial;
            const matchesNatureza = !filtNatureza || (d.naturezaOperacao && d.naturezaOperacao.toUpperCase().includes(filtNatureza.toUpperCase()));
            
            // Filtro hierárquico: se houver drilldown (ranking), ele ganha do filtro lateral se estiver ativo
            const effectiveVendedor = this.drilldownFilter ? this.drilldownFilter.value : filtVendedor;
            const matchesVendedor = !effectiveVendedor || d.vendedor === effectiveVendedor;
            
            const matchesEstado = !filtEstado || d.estado === filtEstado;
            const matchesFrete = filtFrete === 'all' || (filtFrete === 'with' ? d.valorFrete > 0 : d.valorFrete === 0);
            const matchesDifal = filtDifal === 'all' || (filtDifal === 'with' ? (d.difal > 0) : true);
            return matchesSearch && matchesFilial && matchesNatureza && matchesVendedor && matchesEstado && matchesFrete && matchesDifal;
        });

        const billed = filteredData.filter(d => {
            if (d.isCanceled) return false;
            if (d.isExit === false) return false; // REGRA DE OURO: Se é entrada, nunca entra no faturamento
            
            // Se já tem flag isRevenue, respeita. Se não, tenta descobrir (fallback para dados antigos)
            const nat = (d.naturezaOperacao || "").toUpperCase();
            if (nat.includes("RETORNO") || nat.includes("DEVOLU")) return false;
            
            if (d.isRevenue === true) return true;
            return (nat.includes("VENDA") || nat.includes("LOCA") || nat.includes("SAIDA"));
        });
        const total = billed.reduce((sum, d) => sum + d.valorFaturado, 0);
        
        // TODAY'S KPI
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        const billedToday = billed.filter(d => d.dataEmissao === todayStr);
        const totalToday = billedToday.reduce((sum, d) => sum + d.valorFaturado, 0);

        const elToday = shadow.getElementById('kpi-today');
        if (elToday) elToday.textContent = this.formatCurrency(totalToday);
        
        shadow.getElementById('kpi-faturado').textContent = this.formatCurrency(total);
        
        const goal = parseFloat(localStorage.getItem('mci_bi_goal')) || 0;
        const nowLocal = new Date();
        const monthEnd = new Date(parseInt(selYear), parseInt(selMonth), 0).getDate();
        
        // CÁLCULO DE VELOCIDADE (DIAS CORRIDOS)
        let daysPassed = monthEnd; // Default para meses passados
        if (selMonth === String(nowLocal.getMonth() + 1).padStart(2, '0') && selYear === String(nowLocal.getFullYear())) {
            daysPassed = nowLocal.getDate();
        }
        
        const dailyVelocity = total / Math.max(1, daysPassed);
        const forecast = dailyVelocity * monthEnd;

        const elVelocity = shadow.getElementById('kpi-velocity-daily');
        if (elVelocity) elVelocity.textContent = `${this.formatCurrency(dailyVelocity)}/dia`;
        
        const elForecast = shadow.getElementById('kpi-forecast');
        if (elForecast) elForecast.textContent = this.formatCurrency(forecast);
        
        // TOTALIZADORES OPERACIONAIS (Frete/Difal)
        const totalFrete = filteredData.reduce((sum, d) => sum + (d.valorFrete || 0), 0);
        const totalDifal = filteredData.reduce((sum, d) => sum + (d.difal || 0), 0);

        const elFrete = shadow.getElementById('kpi-frete');
        if (elFrete) elFrete.textContent = this.formatCurrency(totalFrete);
        
        const elDifal = shadow.getElementById('kpi-difal');
        if (elDifal) elDifal.textContent = this.formatCurrency(totalDifal);

        if (goal > 0) {
            const percent = (total / goal) * 100;
            shadow.getElementById('kpi-percentage').textContent = `${percent.toFixed(1)}%`;
            shadow.getElementById('kpi-progress-bar').style.width = `${Math.min(100, percent)}%`;
            
            const forecastPercent = (forecast / goal) * 100;
            shadow.getElementById('kpi-forecast-sub').textContent = `Tendência: ${forecastPercent.toFixed(1)}% da meta de ${this.formatCurrency(goal)}`;
        } else {
            shadow.getElementById('kpi-percentage').textContent = '0%';
            shadow.getElementById('kpi-progress-bar').style.width = '0%';
            shadow.getElementById('kpi-forecast-sub').textContent = 'Defina uma meta na Controladoria';
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

        const defaultFiliais = ['MATRIZ (CE)', 'FILIAL (SC)', 'FILIAL (SP)'];
        const filiaisSet = new Set([...defaultFiliais, ...data.map(d => d.filial)]);
        const filiais = [...filiaisSet].filter(f => f && f !== 'N/A').sort();

        const vendedores = [...new Set(data.map(d => d.vendedor))].filter(v => v && v !== 'NAO ATRIBUIDO').sort();
        const estados = [...new Set(data.map(d => d.estado))].filter(Boolean).sort();

        // Update branch filter
        fSelect.innerHTML = '<option value="">Todas Unidades</option>' + filiais.map(f => `<option value="${f}" ${f === currentF ? 'selected' : ''}>${escapeHTML(f)}</option>`).join('');
        
        // Update vendor filter
        vSelect.innerHTML = '<option value="">Todos Vendedores</option>' + vendedores.map(v => `<option value="${v}" ${v === currentV ? 'selected' : ''}>${escapeHTML(v)}</option>`).join('');
        
        // Update state filter
        eSelect.innerHTML = '<option value="">Todos os Estados</option>' + estados.map(e => `<option value="${e}" ${e === currentE ? 'selected' : ''}>${escapeHTML(e)}</option>`).join('');
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
        // Evolução Mensal (Novo Gráfico)
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthlyData = new Array(12).fill(0);
        const monthlyPrevious = new Array(12).fill(0); 

        // Usa todos os dados disponíveis (não apenas o mês filtrado) para o gráfico histórico
        this.reportData.forEach(d => {
            if (d.isCanceled || d.isExit === false) return;
            const date = new Date(d.dataEmissao);
            if (isNaN(date.getTime())) return;
            const month = date.getMonth();
            const year = date.getFullYear();
            
            if (year === 2026) monthlyData[month] += d.valorFaturado;
            else monthlyPrevious[month] += d.valorFaturado;
        });

        const canvasEvo = shadow.getElementById('evolutionChart');
        if (canvasEvo) {
            const ctxEvo = canvasEvo.getContext('2d');
            if (this.evolutionChart) this.evolutionChart.destroy();
            this.evolutionChart = new Chart(ctxEvo, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Faturamento 2026',
                            data: monthlyData,
                            backgroundColor: '#34a85a',
                            borderRadius: 6
                        },
                        {
                            label: 'Histórico Anterior',
                            data: monthlyPrevious,
                            backgroundColor: '#6495ed',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { font: { weight: '600' } } } },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: { callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'k' : v }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
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
            <div class="ranking-item" data-vendedor="${v}" style="display:flex; justify-content:space-between; align-items: center; padding: 1.2rem 1rem; border-bottom:1px solid #f1f5f9; cursor: pointer; transition: all 0.3s; border-radius: 12px; margin-bottom: 4px;">
                <div style="display:flex; align-items:center; gap: 15px;">
                    <div style="width: 32px; height: 32px; background: ${i === 0 ? 'var(--primary)' : '#f1f5f9'}; color: ${i === 0 ? 'white' : '#64748b'}; border-radius: 10px; display: grid; place-items: center; font-weight: 800; font-size: 0.8rem;">
                        ${i+1}
                    </div>
                    <strong>${escapeHTML(v)}</strong>
                </div>
                <span style="font-weight:900; color:#0f172a; font-family: 'Outfit', sans-serif;">${this.formatCurrency(perf[v])}</span>
            </div>
        `).join('');

        // BIND DRILLDOWN EVENTS (SUPER UX)
        this.shadowRoot.querySelectorAll('.ranking-item').forEach(item => {
            item.addEventListener('click', () => {
                this.drilldownFilter = { type: 'vendedor', value: item.dataset.vendedor };
                this.updateUI();
                this.shadowRoot.getElementById('view-dashboard').scrollIntoView({ behavior: 'smooth' });
            });
            item.addEventListener('mouseenter', () => { item.style.background = '#f8fafc'; item.style.transform = 'scale(1.02)'; });
            item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; item.style.transform = 'scale(1)'; });
        });
    }

    renderTable(data = this.reportData) {
        const container = this.shadowRoot.getElementById('table-container');
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Nota</th>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Vendedor (Edit)</th>
                        <th>Natureza</th>
                        <th>Logística</th>
                        <th>Fisco</th>
                        <th style="text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `
                <tr>
                    <td colspan="8" style="padding: 4rem 2rem; text-align: center;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                        <div style="font-size: 1.1rem; font-weight: 800; color: #64748b;">Nenhuma nota encontrada para este filtro ou período.</div>
                        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 5px;">Tente mudar o mês ou ano no menu lateral ou importe novos arquivos.</div>
                    </td>
                </tr>
            `;
        }
        
        data.sort((a,b) => b.dataEmissao.localeCompare(a.dataEmissao)).forEach((d, idx) => {
            const isDemo = d.isDemo || (d.naturezaOperacao && d.naturezaOperacao.toUpperCase().includes("DEMONSTRA"));
            const rowStyle = `
                border-bottom: 1px solid #f1f5f9; 
                ${d.isCanceled ? 'opacity:0.5; color:red; text-decoration:line-through;' : ''}
                ${isDemo ? 'background: rgba(245, 158, 11, 0.05);' : ''}
            `;
            html += `
                <tr style="${rowStyle}">
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
                        <div style="display:flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                            <select class="edit-natureza" 
                                    data-idx="${this.reportData.indexOf(d)}" 
                                    style="padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.75rem; font-weight: 800; width: 100%; cursor: pointer;">
                                <option value="VENDAS CONTRIBUINTES" ${d.naturezaOperacao === 'VENDAS CONTRIBUINTES' ? 'selected' : ''}>Vendas Contribuintes</option>
                                <option value="VENDAS NÃO CONTRIBUINTES" ${d.naturezaOperacao === 'VENDAS NÃO CONTRIBUINTES' ? 'selected' : ''}>Vendas Não Contribuintes</option>
                                <option value="SAÍDA DE LOCAÇÃO" ${d.naturezaOperacao === 'SAÍDA DE LOCAÇÃO' ? 'selected' : ''}>Saída de Locação</option>
                                <option value="RETORNO DE LOCAÇÃO" ${d.naturezaOperacao === 'RETORNO DE LOCAÇÃO' ? 'selected' : ''}>Retorno de Locação</option>
                                <option value="TRANSFERÊNCIA" ${d.naturezaOperacao === 'TRANSFERÊNCIA' ? 'selected' : ''}>Transferência</option>
                                <option value="AMOSTRA/BRINDE" ${d.naturezaOperacao === 'AMOSTRA/BRINDE' ? 'selected' : ''}>Amostra/Brinde</option>
                                <option value="DEVOLUÇÃO" ${d.naturezaOperacao === 'DEVOLUÇÃO' ? 'selected' : ''}>Devolução / Estorno</option>
                                <option value="OUTROS" ${d.naturezaOperacao === 'OUTROS' ? 'selected' : ''}>Outras Operações</option>
                            </select>

                             ${d.isExit === false ? `
                                <span style="font-size: 0.6rem; background: #334155; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 900; text-transform: uppercase; margin-top: 4px;">
                                    ⚠️ ENTRADA (SEM RECEITA)
                                </span>
                            ` : ''}
                            
                            ${isDemo ? `
                                <span style="font-size: 0.6rem; background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 900; text-transform: uppercase; margin-top: 4px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);">
                                    📦 DEMONSTRAÇÃO
                                </span>
                            ` : ''}
                        </div>
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
                    <td style="padding: 1rem; text-align:right; font-weight:800; font-size: 1.1rem; color: ${ (d.isExit !== false && !d.isCanceled && (d.isRevenue || ( (d.naturezaOperacao||"").toUpperCase().includes("VENDA") || (d.naturezaOperacao||"").toUpperCase().includes("LOCA") ) ) && !( (d.naturezaOperacao||"").toUpperCase().includes("RETORNO") || (d.naturezaOperacao||"").toUpperCase().includes("DEVOLU") ) ) ? '#0d8377' : '#94a3b8'};">
                        ${this.formatCurrency(d.valorFaturado)}
                    </td>
                </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;

        // BIND EDIT EVENTS (VENDOR)
        container.querySelectorAll('.edit-vendedor').forEach(input => {
            input.addEventListener('change', async (e) => {
                const idx = e.target.getAttribute('data-idx');
                const newVal = e.target.value;
                this.reportData[idx].vendedor = newVal;
                this.syncSingleChange(idx);
            });
        });

        // BIND EDIT EVENTS (NATUREZA)
        container.querySelectorAll('.edit-natureza').forEach(input => {
            input.addEventListener('change', async (e) => {
                const idx = e.target.getAttribute('data-idx');
                const newVal = e.target.value;
                this.reportData[idx].naturezaOperacao = newVal;
                
                // Se mudou para Retorno ou Devolução, força isRevenue como false por segurança
                if (newVal.includes('RETORNO') || newVal.includes('DEVOLUÇÃO')) {
                    this.reportData[idx].isRevenue = false;
                }
                
                this.syncSingleChange(idx);
            });
        });
    }

    async syncSingleChange(idx) {
        this.showToast('Atualizando dados...', 'info');
        try {
            await DatabaseService.syncToSupabase([this.reportData[idx]]);
            this.showToast('Registro atualizado com sucesso!', 'success');
            localStorage.setItem('mci_last_data', JSON.stringify(this.reportData));
            this.updateUI(true);
        } catch (err) {
            this.showToast('Erro ao sincronizar alteração.', 'error');
        }
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
