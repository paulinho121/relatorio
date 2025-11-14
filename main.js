class NfeReportGenerator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #333;
                }
                .app-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 2rem;
                    background-color: #fff;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.05);
                }
                .logo { max-height: 50px; object-fit: contain; }
                .header-info { text-align: right; }
                .header-info h1 { margin: 0; font-size: 1.6rem; font-weight: 600; color: #199B8E; }
                .header-info p { margin: 0; font-size: 0.9rem; color: #5f6368; }
                .container { background: #fff; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.07); }
                h2 { color: #199B8E; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; margin-top: 2rem; margin-bottom: 1.5rem; font-size: 1.4rem; font-weight: 600; }
                h3 { font-size: 1.2rem; font-weight: 600; color: #333; }
                .file-drop-area { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2rem; border: 2px dashed #e0e0e0; border-radius: 8px; background-color: #fafafa; text-align: center; cursor: pointer; transition: background-color 0.2s, border-color 0.2s; }
                .file-drop-area.dragover { background-color: #e8f5f3; border-color: #199B8E; }
                #file-input-label { display: inline-block; padding: 12px 24px; background-color: #199B8E; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; transition: background-color 0.2s; }
                #file-input-label:hover { background-color: #137a6f; }
                #xml-files { display: none; }
                #file-count { margin-top: 1rem; color: #5f6368; font-weight: 500; }
                #action-buttons { margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center; display: none; }
                #action-buttons button { padding: 12px 24px; border: none; color: white; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 500; transition: background-color 0.2s; }
                #print-button { background-color: #199B8E; }
                #print-button:hover { background-color: #137a6f; }
                #export-button { background-color: #93C572; color: white; }
                #export-button:hover { background-color: #82b45f; }
                #report-container { margin-top: 2rem; overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                th, td { border: 1px solid #e0e0e0; padding: 12px 15px; text-align: left; font-size: 0.9rem; }
                th { background-color: #f7f7f7; position: sticky; top: 0; font-weight: 600; border-bottom-width: 2px; }
                tr.canceled-row { background-color: #fee2e2; text-decoration: line-through; color: #b91c1c; }
                tr:nth-child(even):not(.canceled-row) { background-color: #fdfdfd; }
                tr:hover:not(.canceled-row) { background-color: #e8f5f3; }
                .summary { margin-top: 2rem; padding: 1.5rem; background-color: #e8f5f3; border-left: 5px solid #199B8E; border-radius: 8px; }
                .summary h3 { margin-top: 0; margin-bottom: 1rem; color: #199B8E; }
                .summary p { margin: 0.5rem 0; }
                .summary p strong { font-weight: 600; }
                .filial-summary { margin-top: 1rem; padding: 0.8rem 1.2rem; background-color: #f7f9f9; border-radius: 6px; font-weight: 600; text-align: right; }
                .error { color: #d93025; background-color: #fce8e6; border: 1px solid #d93025; padding: 1rem; border-radius: 8px; margin-top: 1rem; }

                @media print {
                    :host, body {
                        background: #fff;
                        color: #000;
                        margin: 0;
                        padding: 0;
                    }
                    .app-header {
                         border-bottom: 2px solid #ccc;
                         padding-bottom: 1rem;
                         margin-bottom: 1.5rem;
                         width: 100%;
                         box-shadow: none;
                         border-radius: 0;
                    }
                    .logo { max-height: 40px; }
                    .header-info h1 { font-size: 18pt; color: #000; }
                    .header-info p { font-size: 9pt; color: #000; }
                    #file-drop-area-wrapper, #action-buttons, #file-count, .error { display: none; }
                    .container, #report-container { box-shadow: none; border-radius: 0; padding: 0; margin: 0; }
                    h2 { font-size: 14pt; color: #000; }
                    table { break-inside: auto; }
                    tr { break-inside: avoid; break-after: auto; }
                    thead { display: table-header-group; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 9pt; }
                    th { background-color: #f2f2f2; }
                    tr.canceled-row { background-color: #fee2e2 !important; }
                    .summary, .filial-summary { page-break-inside: avoid; border: 1px solid #ddd; background-color: #fdfdfd; }
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
                <div id="report-container"><!-- Report will be generated here --></div>
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
            fileInput.files = files;
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
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
        reportContainer.innerHTML = `<p>Processando ${files.length} arquivos...</p>`;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const xmlString = e.target.result;
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
                    if (xmlDoc.getElementsByTagName('parsererror').length > 0) throw new Error('Arquivo XML inválido ou corrompido.');

                    const procEvento = xmlDoc.getElementsByTagName('procEventoNFe')[0];
                    if (procEvento) {
                        const descEvento = procEvento.getElementsByTagName('descEvento')[0]?.textContent;
                        if (descEvento === 'Cancelamento') {
                            const chNFe = procEvento.getElementsByTagName('chNFe')[0]?.textContent;
                            reportData.push({ isCanceledEvent: true, numeroNota: chNFe.substring(25, 34), fileName: file.name });
                            return;
                        }
                    }

                    const protNFe = xmlDoc.getElementsByTagName('protNFe')[0];
                    const isCanceled = protNFe && protNFe.getElementsByTagName('xMotivo')[0]?.textContent.toLowerCase().includes('cancelamento');
                    const nfeNode = xmlDoc.getElementsByTagName('nfeProc')[0] || xmlDoc.getElementsByTagName('NFe')[0];
                    if (!nfeNode) throw new Error('Estrutura XML não reconhecida.');
                    const infNFeNode = nfeNode.getElementsByTagName('infNFe')[0];
                    if (!infNFeNode) throw new Error('Estrutura XML incompleta.');

                    const getValue = (path) => path.split('/').reduce((node, part) => node?.getElementsByTagName(part)[0], infNFeNode)?.textContent || null;
                    
                    const freteValor = parseFloat(getValue('total/ICMSTot/vFrete') || 0);
                    const modFrete = getValue('transp/modFrete');
                    
                    reportData.push({
                        filial: getValue('emit/xNome') || 'Filial Não Identificada',
                        filialUF: getValue('emit/enderEmit/UF') || 'N/A',
                        numeroNota: getValue('ide/nNF') || 'N/A',
                        cliente: getValue('dest/xNome') || 'N/A',
                        cidade: getValue('dest/enderDest/xMun') || 'N/A',
                        estado: getValue('dest/enderDest/UF') || 'N/A',
                        contribuinte: {'1': 'Sim (Contribuinte ICMS)', '2': 'Isento', '9': 'Não Contribuinte'}[getValue('dest/indIEDest')] || 'Não Informado',
                        frete: freteValor > 0 ? `Sim (${this.formatCurrency(freteValor)})` : {'0': 'Sim (Emitente)', '1': 'Sim (Destinatário)', '9': 'Não (Sem Frete)'}[modFrete] || 'Não Informado',
                        valorFrete: freteValor,
                        difal: parseFloat(getValue('total/ICMSTot/vICMSUFDest') || 0),
                        valorFaturado: parseFloat(getValue('total/ICMSTot/vNF') || 0) + parseFloat(getValue('total/ICMSTot/vFCPUFDest') || 0),
                        isCanceled
                    });
                } catch (error) {
                    reportData.push({ error: error.message, fileName: file.name });
                } finally {
                    filesProcessed++;
                    if (filesProcessed === files.length) {
                        this.generateReport(reportData, reportContainer, actionButtons, exportButton);
                    }
                }
            };
            reader.onerror = () => {
                reportData.push({ error: 'Erro de leitura do arquivo.', fileName: file.name });
                filesProcessed++;
                if (filesProcessed === files.length) {
                    this.generateReport(reportData, reportContainer, actionButtons, exportButton);
                }
            };
            reader.readAsText(file, 'UTF-8');
        });
    }
    generateReport(data, reportContainer, actionButtons, exportButton) {
        const errors = data.filter(item => item.error);
        const canceledEvents = new Map(data.filter(d => d.isCanceledEvent).map(d => [d.numeroNota, d]));
        const nfeData = data.filter(d => !d.isCanceledEvent && !d.error);

        const finalData = nfeData.map(item => ({...item, status: (item.isCanceled || canceledEvents.has(item.numeroNota)) ? 'Cancelada' : 'Faturada' }));
        
        const billedData = finalData.filter(item => item.status === 'Faturada');
        const canceledData = finalData.filter(item => item.status === 'Cancelada');

        canceledEvents.forEach((event, numeroNota) => {
            if (!finalData.some(d => d.numeroNota === numeroNota)) {
                canceledData.push({ numeroNota, cliente: 'Info no evento de cancelamento', valorFaturado: 0, status: 'Cancelada', fromEvent: true });
            }
        });

        let html = '';
        reportContainer.innerHTML = '';

        if (finalData.length > 0) {
            actionButtons.style.display = 'flex';
            exportButton.onclick = () => this.exportToCsv(finalData);
        }

        if (billedData.length > 0) {
            const grouped = billedData.reduce((acc, item) => {
                const key = `${item.filial} (${item.filialUF})`;
                (acc[key] = acc[key] || []).push(item);
                return acc;
            }, {});

            html += '<h2>Notas Fiscais Faturadas</h2>';
            for (const filialKey of Object.keys(grouped).sort()) {
                html += `<h3>${filialKey}</h3>`;
                html += '<table><thead><tr><th>Nº Nota</th><th>Cliente</th><th>Cidade/UF</th><th>Contribuinte</th><th>Frete</th><th>DIFAL</th><th>Valor Faturado</th></tr></thead><tbody>';
                let subtotal = 0;
                grouped[filialKey].forEach(item => {
                    subtotal += item.valorFaturado;
                    html += `<tr>
                        <td>${item.numeroNota}</td><td>${item.cliente}</td><td>${item.cidade}/${item.estado}</td><td>${item.contribuinte}</td>
                        <td>${item.frete}</td><td style="text-align: right;">${this.formatCurrency(item.difal)}</td><td style="text-align: right;">${this.formatCurrency(item.valorFaturado)}</td>
                    </tr>`;
                });
                html += '</tbody></table>';
                html += `<div class="filial-summary">Total Faturado na Filial: <strong>${this.formatCurrency(subtotal)}</strong></div>`;
            }
            
            const totalBilled = billedData.reduce((sum, item) => sum + item.valorFaturado, 0);
            html += `<div class="summary"><h3>Resumo Geral de Faturamento</h3><p>Total de Notas Faturadas: <strong>${billedData.length}</strong></p><p>Total Faturado: <strong>${this.formatCurrency(totalBilled)}</strong></p></div>`;
        }

        if (canceledData.length > 0) {
            html += '<h2>Notas Fiscais Canceladas</h2><table><thead><tr><th>Nº Nota</th><th>Cliente</th><th>Valor Cancelado</th></tr></thead><tbody>';
            let totalCanceled = 0;
            canceledData.sort((a, b) => a.numeroNota.localeCompare(b.numeroNota)).forEach(item => {
                totalCanceled += item.valorFaturado;
                html += `<tr class="canceled-row"><td>${item.numeroNota}</td><td>${item.cliente || 'N/A'}</td><td style="text-align: right;">${this.formatCurrency(item.valorFaturado)}</td></tr>`;
            });
            html += '</tbody></table>';
            html += `<div class="filial-summary" style="border-left-color: #d93025; background-color: #fce8e6;">Total Cancelado: <strong>${this.formatCurrency(totalCanceled)} (${canceledData.length} notas)</strong></div>`;
        }

        if (errors.length > 0) {
            html += '<h2>Erros de Processamento</h2>';
            errors.forEach(err => { html += `<p class="error"><strong>Arquivo: ${err.fileName}</strong><br>${err.error}</p>`; });
        }
        
        if (finalData.length === 0 && errors.length === 0) {
            html = '<p>Nenhum dado de NFe encontrado nos arquivos para gerar o relatório.</p>';
        }

        reportContainer.innerHTML = html;
    }
    exportToCsv(data) {
        const headers = ["Filial", "UF Filial", "Nº Nota", "Cliente", "Cidade/UF", "Contribuinte", "Frete", "Valor DIFAL", "Valor Faturado", "Status"];
        const csvRows = data.map(item => [
                item.filial, item.filialUF, item.numeroNota, item.cliente, `${item.cidade}/${item.estado}`,
                item.contribuinte, item.frete.includes('R$') ? item.frete.match(/R\$ ([\d,.]+)/)[1].replace('.', '').replace(',', '.') : item.frete,
                item.difal.toFixed(2), item.valorFaturado.toFixed(2), item.status
            ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')
        );
        const csvString = ["﻿" + headers.join(','), ...csvRows].join('
');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'relatorio_faturamento.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
customElements.define('nfe-report-generator', NfeReportGenerator);
