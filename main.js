class NfeReportGenerator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }

                .app-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 2rem;
                    background-color: var(--surface-color);
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.05);
                }

                .logo {
                    max-height: 50px;
                    object-fit: contain;
                }
                
                .header-info {
                    text-align: right;
                }

                .header-info h1 {
                    margin: 0;
                    font-size: 1.6rem;
                    font-weight: 600;
                    color: var(--primary-color);
                }

                .header-info p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #5f6368;
                }


                .container {
                    background: var(--surface-color);
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.07);
                }

                h2 {
                    color: var(--primary-color);
                    border-bottom: 2px solid var(--border-color);
                    padding-bottom: 0.5rem;
                    margin-top: 2rem;
                    margin-bottom: 1.5rem;
                    font-size: 1.4rem;
                    font-weight: 600;
                }

                .file-drop-area {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 2rem;
                    border: 2px dashed var(--border-color);
                    border-radius: 8px;
                    background-color: #fafafa;
                    text-align: center;
                    cursor: pointer;
                    transition: background-color 0.2s, border-color 0.2s;
                }

                .file-drop-area.dragover {
                     background-color: var(--light-primary-bg);
                     border-color: var(--primary-color);
                }

                .file-drop-area p {
                    margin: 0.5rem 0 1rem;
                    font-size: 1rem;
                    color: #5f6368;
                }

                #file-input-label {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: var(--primary-color);
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.2s, transform 0.2s;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                #file-input-label:hover {
                    background-color: #137a6f;
                    transform: translateY(-2px);
                }

                #xml-files {
                    display: none;
                }

                #file-count {
                    margin-top: 1rem;
                    color: #5f6368;
                    font-weight: 500;
                }

                #action-buttons {
                    margin-top: 1.5rem;
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    display: none; /* Hidden by default */
                }

                #action-buttons button {
                    padding: 12px 24px;
                    border: none;
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    letter-spacing: 0.5px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                #print-button {
                   background-color: var(--primary-color);
                }
                #print-button:hover {
                    background-color: #137a6f;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
                }

                #export-button {
                   background-color: var(--secondary-color);
                   color: white;
                }
                #export-button:hover {
                    background-color: #82b45f;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.12);
                }

                #report-container {
                    margin-top: 2rem;
                    overflow-x: auto;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                }

                th, td {
                    border: 1px solid var(--border-color);
                    padding: 12px 15px;
                    text-align: left;
                    font-size: 0.9rem;
                }

                th {
                    background-color: var(--header-bg-color);
                    color: var(--text-color);
                    position: sticky;
                    top: 0;
                    font-weight: 600;
                    border-bottom-width: 2px;
                }

                tr.canceled-row {
                    background-color: #fee2e2; 
                    text-decoration: line-through;
                    color: #b91c1c;
                }
                tr.canceled-row:hover {
                    background-color: #fecaca;
                }
                
                tr:nth-child(even):not(.canceled-row) {
                    background-color: #fdfdfd;
                }
                tr:hover:not(.canceled-row) {
                    background-color: var(--light-primary-bg);
                }

                .summary {
                    margin-top: 2rem;
                    padding: 1.5rem;
                    background-color: var(--light-primary-bg);
                    border-left: 5px solid var(--primary-color);
                    border-radius: 8px;
                }

                .summary h3 {
                    margin-top: 0;
                    margin-bottom: 1rem;
                    color: var(--primary-color);
                    font-size: 1.3rem;
                    font-weight: 600;
                }

                .summary p {
                    margin: 0.5rem 0;
                    font-size: 1rem;
                }
                .summary p strong {
                    font-weight: 600;
                }

                .filial-summary {
                    margin-top: 1rem;
                    padding: 0.8rem 1.2rem;
                    background-color: #f7f9f9;
                    border-radius: 6px;
                    font-weight: 600;
                    text-align: right;
                    font-size: 1rem;
                }

                .error {
                    color: var(--error-color);
                    background-color: var(--error-bg);
                    border: 1px solid var(--error-color);
                    padding: 1rem;
                    border-radius: 8px;
                    margin-top: 1rem;
                }

                @media print {
                    body, nfe-report-generator {
                        margin: 0;
                        padding: 0;
                        box-shadow: none;
                        font-family: 'Segoe UI', sans-serif;
                        background: #fff;
                        color: #000;
                        font-size: 9pt;
                    }

                    .app-header {
                         display: flex;
                         justify-content: space-between;
                         align-items: center;
                         border-bottom: 2px solid #ccc;
                         padding: 0 0 1rem 0;
                         margin-bottom: 1.5rem;
                         border-radius: 0;
                         box-shadow: none;
                         width: 100%;
                    }

                    .logo {
                        max-height: 40px;
                    }

                    .header-info h1 {
                        font-size: 18pt;
                    }
                     .header-info p {
                        font-size: 9pt;
                    }

                    .container,
                    #report-container {
                        box-shadow: none;
                        border-radius: 0;
                        padding: 0;
                    }

                    #file-drop-area-wrapper, #action-buttons, #file-count {
                        display: none;
                    }

                    #report-container, h2 {
                        margin-top: 0;
                    }

                    h1, h2, h3 {
                        page-break-after: avoid;
                        page-break-inside: avoid;
                        color: #333;
                    }

                    h2 {
                        font-size: 14pt;
                        margin-top: 1.5rem;
                        margin-bottom: 1rem;
                        border-bottom: 1px solid #eaeaea;
                        padding-bottom: 0.5rem;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 1rem;
                        break-inside: auto;
                    }

                    tr { break-inside: avoid; break-after: auto; }
                    thead { display: table-header-group; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 9pt; }
                    th { background-color: #f2f2f2; font-weight: 600; color: #333; }
                    tr.canceled-row { background-color: #fee2e2 !important; }
                    tr:nth-child(even) { background-color: #f9f9f9; }

                    .summary, .filial-summary {
                        page-break-inside: avoid;
                        margin-top: 1.5rem;
                        padding: 1rem;
                        border: 1px solid #ddd;
                        border-left: 5px solid var(--primary-color);
                        background-color: #fdfdfd;
                        border-radius: 5px;
                    }
                    .filial-summary {
                         border-left: 5px solid var(--secondary-color);
                    }
                    .error { display: none; }
                }

            </style>
            <header class="app-header">
                 <img src="logo.png" alt="Logomarca MCI" class="logo" onerror="this.style.display='none'">
                 <div class="header-info">
                    <h1>Relatório de Faturamento</h1>
                    <p id="report-date"></p>
                 </div>
            </header>

            <div class="container">
                <div id="file-drop-area-wrapper">
                    <div class="file-drop-area" id="file-drop-area">
                        <p>Arraste e solte os arquivos XML aqui ou</p>
                        <label for="xml-files" id="file-input-label">Escolher arquivos</label>
                        <input type="file" id="xml-files" accept=".xml" multiple>
                    </div>
                    <div id="file-count">Nenhum arquivo selecionado</div>
                </div>
                
                <div id="action-buttons">
                    <button id="print-button">Imprimir Relatório</button>
                    <button id="export-button">Exportar para CSV</button>
                </div>

                <div id="report-container">
                    <!-- O relatório será inserido aqui -->
                </div>
            </div>
        `;
    }
    
    formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const fileInput = shadow.querySelector('#xml-files');
        const fileDropArea = shadow.querySelector('#file-drop-area');
        const fileCount = shadow.querySelector('#file-count');
        const reportContainer = shadow.querySelector('#report-container');
        const actionButtons = shadow.querySelector('#action-buttons');
        const printButton = shadow.querySelector('#print-button');
        const exportButton = shadow.querySelector('#export-button');
        const reportDateEl = shadow.querySelector('#report-date');

        reportDateEl.textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            fileCount.textContent = files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : 'Nenhum arquivo selecionado';
            this.handleFileSelect(event, reportContainer, actionButtons, exportButton);
        });

        // Drag and drop events
        fileDropArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            fileDropArea.classList.add('dragover');
        });
        fileDropArea.addEventListener('dragleave', () => {
            fileDropArea.classList.remove('dragover');
        });
        fileDropArea.addEventListener('drop', (event) => {
            event.preventDefault();
            fileDropArea.classList.remove('dragover');
            const files = event.dataTransfer.files;
            fileInput.files = files; // Assign dropped files to the input
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent); // Trigger the change event
        });
        fileDropArea.addEventListener('click', () => fileInput.click());


        printButton.addEventListener('click', () => window.print());
    }

    handleFileSelect(event, reportContainer, actionButtons, exportButton) {
        actionButtons.style.display = 'none';
        const files = event.target.files;
        if (files.length === 0) {
            reportContainer.innerHTML = '';
            return;
        }

        const reportData = [];
        let filesProcessed = 0;
        const totalFiles = files.length;

        reportContainer.innerHTML = `<p>Processando ${totalFiles} arquivos...</p>`;

        const processFile = (file) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const xmlString = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

                    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                        throw new Error('Arquivo XML inválido ou corrompido.');
                    }

                    const procEvento = xmlDoc.getElementsByTagName('procEventoNFe')[0];
                    if (procEvento) {
                        const evento = procEvento.getElementsByTagName('evento')[0];
                        const detEvento = evento?.getElementsByTagName('detEvento')[0];
                        const descEvento = detEvento?.getElementsByTagName('descEvento')[0]?.textContent;

                        if (descEvento === 'Cancelamento') {
                            const chNFe = evento.getElementsByTagName('chNFe')[0]?.textContent;
                            reportData.push({ isCanceledEvent: true, numeroNota: chNFe.substring(25, 34), fileName: file.name });
                            return;
                        }
                    }

                    const protNFe = xmlDoc.getElementsByTagName('protNFe')[0];
                    const isCanceled = protNFe && protNFe.getElementsByTagName('xMotivo')[0]?.textContent.toLowerCase().includes('cancelamento');

                    const nfeNode = xmlDoc.getElementsByTagName('nfeProc')[0] || xmlDoc.getElementsByTagName('NFe')[0];
                    if (!nfeNode) throw new Error('Estrutura XML não reconhecida (tag <nfeProc> ou <NFe> não encontrada).');
                    
                    const infNFeNode = nfeNode.getElementsByTagName('infNFe')[0];
                    if (!infNFeNode) throw new Error('Estrutura XML incompleta (tag <infNFe> não encontrada).');

                    const getValue = (path) => {
                        const parts = path.split('/');
                        let node = infNFeNode;
                        for (const part of parts) {
                            if (!node) return null;
                            node = node.getElementsByTagName(part)[0];
                        }
                        return node ? node.textContent : null;
                    };
                    
                    const freteValor = parseFloat(getValue('total/ICMSTot/vFrete') || 0);
                    const modFrete = getValue('transp/modFrete');
                    const valorFecop = parseFloat(getValue('total/ICMSTot/vFCPUFDest') || 0);
                    const valorNota = parseFloat(getValue('total/ICMSTot/vNF') || 0);

                    reportData.push({
                        filial: getValue('emit/xNome') || 'Filial Não Identificada',
                        filialUF: getValue('emit/enderEmit/UF') || 'N/A',
                        numeroNota: getValue('ide/nNF') || 'N/A',
                        cliente: getValue('dest/xNome') || 'N/A',
                        cidade: getValue('dest/enderDest/xMun') || 'N/A',
                        estado: getValue('dest/enderDest/UF') || 'N/A',
                        contribuinte: ((ind) => {
                            switch (ind) {
                                case '1': return 'Sim (Contribuinte ICMS)';
                                case '2': return 'Isento';
                                case '9': return 'Não Contribuinte';
                                default: return 'Não Informado';
                            }
                        })(getValue('dest/indIEDest')),
                        frete: ((mod, val) => {
                            if (val > 0) return `Sim (${this.formatCurrency(val)})`;
                            switch (mod) {
                                case '0': return 'Sim (Emitente)';
                                case '1': return 'Sim (Destinatário)';
                                case '9': return 'Não (Sem Frete)';
                                default: return 'Não Informado';
                            }
                        })(modFrete, freteValor),
                        valorFrete: freteValor,
                        difal: parseFloat(getValue('total/ICMSTot/vICMSUFDest') || 0),
                        valorFaturado: valorNota + valorFecop,
                        isCanceled
                    });

                } catch (error) {
                    reportData.push({ error: error.message, fileName: file.name });
                } finally {
                    filesProcessed++;
                    if (filesProcessed === totalFiles) {
                        this.generateReport(reportData, reportContainer, actionButtons, exportButton);
                    }
                }
            };

            reader.onerror = () => {
                reportData.push({ error: 'Erro de leitura do arquivo.', fileName: file.name });
                filesProcessed++;
                if (filesProcessed === totalFiles) {
                    this.generateReport(reportData, reportContainer, actionButtons, exportButton);
                }
            };

            reader.readAsText(file, 'UTF-8');
        };

        Array.from(files).forEach(processFile);
    }

    generateReport(data, reportContainer, actionButtons, exportButton) {
        const errors = data.filter(item => item.error);
        
        const canceledEvents = data.filter(d => d.isCanceledEvent);
        const otherData = data.filter(d => !d.isCanceledEvent);

        let billedData = otherData.filter(item => !item.isCanceled);
        let canceledData = otherData.filter(item => item.isCanceled);

        canceledEvents.forEach(event => {
            const correspondingNoteIndex = billedData.findIndex(d => d.numeroNota === event.numeroNota);
            if (correspondingNoteIndex > -1) {
                const noteToCancel = billedData.splice(correspondingNoteIndex, 1)[0];
                if (!canceledData.some(c => c.numeroNota === noteToCancel.numeroNota)) {
                    canceledData.push({ ...noteToCancel, isCanceled: true });
                }
            } else if (!canceledData.some(c => c.numeroNota === event.numeroNota)) {
                 canceledData.push({
                    numeroNota: event.numeroNota,
                    cliente: 'Informação não disponível no XML de evento',
                    valorFaturado: 0,
                    isCanceled: true,
                    fromEvent: true
                });
            }
        });

        let html = '';
        reportContainer.innerHTML = '';

        if (billedData.length > 0) {
            actionButtons.style.display = 'flex';
            exportButton.onclick = () => this.exportToCsv(data.filter(item => !item.error));

            const groupedByFilial = billedData.reduce((acc, item) => {
                const key = `${item.filial} (${item.filialUF})`;
                (acc[key] = acc[key] || []).push(item);
                return acc;
            }, {});

            html += '<h2>Notas Fiscais Faturadas</h2>';

            for (const filialKey of Object.keys(groupedByFilial).sort()) {
                html += `<h3>${filialKey}</h3>`;
                html += '<table><thead><tr><th>Nº Nota</th><th>Cliente</th><th>Cidade/UF</th><th>Contribuinte</th><th>Frete</th><th>DIFAL</th><th>Valor Faturado</th></tr></thead><tbody>';
                
                let subtotalFilial = 0;
                groupedByFilial[filialKey].forEach(item => {
                     subtotalFilial += item.valorFaturado;
                    html += `<tr>
                        <td>${item.numeroNota}</td>
                        <td>${item.cliente}</td>
                        <td>${item.cidade}/${item.estado}</td>
                        <td>${item.contribuinte}</td>
                        <td>${item.frete}</td>
                        <td style="text-align: right;">${this.formatCurrency(item.difal)}</td>
                        <td style="text-align: right;">${this.formatCurrency(item.valorFaturado)}</td>
                    </tr>`;
                });

                html += '</tbody></table>';
                html += `<div class="filial-summary">Total Faturado na Filial: <strong>${this.formatCurrency(subtotalFilial)}</strong></div>`;
            }
            
            const totalFaturadoDia = billedData.reduce((sum, item) => sum + item.valorFaturado, 0);
            const totalDifalDia = billedData.reduce((sum, item) => sum + item.difal, 0);
            const totalFreteDia = billedData.reduce((sum, item) => sum + item.valorFrete, 0);
            
            html += `<div class="summary">
                        <h3>Resumo Geral de Faturamento</h3>
                        <p>Total de Notas Faturadas: <strong>${billedData.length}</strong></p>
                        <p>Total Faturado (Todas Filiais): <strong>${this.formatCurrency(totalFaturadoDia)}</strong></p>
                        <p>Total de Frete (Notas Faturadas): <strong>${this.formatCurrency(totalFreteDia)}</strong></p>
                        <p>Total de DIFAL (Notas Faturadas): <strong>${this.formatCurrency(totalDifalDia)}</strong></p>
                    </div>`;
        }

         if (canceledData.length > 0) {
            html += '<h2>Notas Fiscais Canceladas</h2>';
            html += '<table><thead><tr><th>Nº Nota</th><th>Cliente</th><th>Cidade/UF</th><th>Valor Cancelado</th></tr></thead><tbody>';
            
            let totalCanceledValue = 0;
            canceledData.sort((a, b) => a.numeroNota.localeCompare(b.numeroNota));

            canceledData.forEach(item => {
                totalCanceledValue += item.valorFaturado;
                html += `<tr class="canceled-row">
                    <td>${item.numeroNota}</td>
                    <td>${item.cliente || 'N/A'}</td>
                    <td>${item.cidade && item.estado ? `${item.cidade}/${item.estado}` : 'N/A'}</td>
                    <td style="text-align: right;">${this.formatCurrency(item.valorFaturado)}</td>
                </tr>`;
            });

            html += '</tbody></table>';
             html += `<div class="filial-summary" style="border-left-color: var(--error-color);">Total Cancelado: <strong>${this.formatCurrency(totalCanceledValue)} (${canceledData.length} notas)</strong></div>`;
        }

        if (errors.length > 0) {
            html += '<h2>Erros de Processamento</h2>';
            errors.forEach(err => { 
                html += `<p class="error"><strong>Arquivo: ${err.fileName}</strong><br>${err.error}</p>`; 
            });
        }
        
        if (billedData.length === 0 && canceledData.length === 0 && errors.length > 0) {
             html = '<p>Todos os arquivos selecionados continham erros.</p>';
        } else if (billedData.length === 0 && canceledData.length === 0) {
            html = '<p>Nenhum dado de NFe encontrado nos arquivos para gerar o relatório.</p>';
        }

        reportContainer.innerHTML = html;
    }

    exportToCsv(data) {
        // Logic to handle canceled notes correctly for CSV export
        const canceledEvents = data.filter(d => d.isCanceledEvent);
        const otherData = data.filter(d => !d.isCanceledEvent);
        const finalData = [];

        otherData.forEach(item => {
            const isExplicitlyCanceled = item.isCanceled;
            const isCanceledByEvent = canceledEvents.some(e => e.numeroNota === item.numeroNota);
            const status = (isExplicitlyCanceled || isCanceledByEvent) ? 'Cancelada' : 'Faturada';
            finalData.push({ ...item, status });
        });

        const headers = ["Filial", "UF Filial", "Nº Nota", "Cliente", "Cidade/UF Cliente", "Contribuinte", "Frete", "Valor DIFAL (R$)", "Valor Faturado (R$)", "Status"];
        
        const csvRows = finalData.map(item => {
            const values = [
                item.filial,
                item.filialUF,
                item.numeroNota,
                item.cliente,
                `${item.cidade}/${item.estado}`,
                item.contribuinte,
                item.frete.includes('R$') ? item.frete.match(/R\$ ([\d,.]+)/)[1].replace('.', '').replace(',', '.') : item.frete,
                item.difal.toFixed(2),
                item.valorFaturado.toFixed(2),
                item.status
            ];
            return values.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
        });

        const csvString = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob(["﻿" + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'relatorio_faturamento.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
customElements.define('nfe-report-generator', NfeReportGenerator);
