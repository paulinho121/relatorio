# Blueprint: Gerador de Relatório de NFe

## Visão Geral

Esta aplicação é uma ferramenta web para processar arquivos XML de Nota Fiscal Eletrônica (NFe). Ela permite que o usuário arraste e solte múltiplos arquivos XML, processa esses arquivos para extrair informações relevantes, e então exibe um relatório de faturamento consolidado na tela. O relatório distingue entre notas faturadas e canceladas, agrupa os dados por filial, e fornece um resumo geral. A aplicação também oferece funcionalidades para imprimir o relatório, exportar os dados para um arquivo CSV e excluir linhas específicas do relatório antes de finalizá-lo.

## Estilo e Design

- **Layout:** Moderno, limpo e responsivo, com um cabeçalho claro, uma área de upload de arquivos bem definida e um contêiner para o relatório gerado.
- **Cores:** Utiliza uma paleta de cores profissional, com tons de verde (#199B8E) para destaque e ações primárias, cinzas para texto e fundos suaves (#f4f7f6), e vermelho (#d93025) para ações de exclusão.
- **Tipografia:** Usa a fonte "Poppins" para uma aparência moderna e legível.
- **Componentes:**
    - **Cabeçalho:** Contém o logo da empresa (se disponível) e o título do relatório com a data atual.
    - **Área de Upload:** Uma zona de "arrastar e soltar" interativa que também funciona como um botão de clique para selecionar arquivos. A área muda de cor para dar feedback visual quando um arquivo é arrastado sobre ela.
    - **Botões de Ação:** Botões para "Imprimir Relatório", "Exportar para CSV" e "Excluir Linhas" que aparecem após o processamento dos arquivos.
    - **Tabela de Relatório:** Exibe os dados de forma clara, com cabeçalhos fixos e linhas alternadas. Cada linha possui um checkbox para seleção. Notas canceladas são visualmente destacadas.
    - **Resumos:** Seções de resumo para totais por filial e um resumo geral do faturamento.
- **Efeitos:** Sombras sutis (`box-shadow`) são usadas para criar uma sensação de profundidade e destacar os elementos principais.

## Funcionalidades Implementadas

1.  **Componente Web Encapsulado (`nfe-report-generator`):** Toda a funcionalidade da aplicação está contida dentro de um Custom Element, utilizando Shadow DOM para garantir que seus estilos e scripts não conflitem com o resto da página.

2.  **Upload de Arquivos Flexível:**
    - O usuário pode adicionar arquivos XML clicando em um botão e selecionando-os.
    - O usuário pode arrastar e soltar os arquivos diretamente na área designada.

3.  **Processamento de XML no Cliente:**
    - A aplicação lê e processa os arquivos XML diretamente no navegador, sem necessidade de enviá-los para um servidor.
    - Utiliza a `DOMParser` API para analisar o conteúdo dos arquivos XML.
    - Extrai as seguintes informações de cada NFe: Filial (emissor), Cliente (destinatário), número da nota, valores, status (faturada ou cancelada), entre outros.
    - Identifica e trata notas de cancelamento, tanto em arquivos de evento (`procEventoNFe`) quanto em notas que contêm a informação de cancelamento no seu XML principal (`protNFe`).

4.  **Geração de Relatório Dinâmico:**
    - Exibe uma tabela com as notas fiscais faturadas, agrupadas por filial.
    - Calcula e exibe o subtotal faturado para cada filial.
    - Exibe uma tabela separada para as notas fiscais canceladas.
    - Apresenta um resumo geral com o total de notas faturadas e o valor total do faturamento.
    - Mostra mensagens de erro caso algum arquivo XML seja inválido ou não possa ser lido.

5.  **Exclusão de Linhas do Relatório:**
    - **Seleção:** Uma caixa de seleção (checkbox) é adicionada a cada linha do relatório de notas faturadas. Uma caixa "selecionar tudo" no cabeçalho da tabela permite marcar ou desmarcar todas as notas de uma vez.
    - **Botão de Exclusão:** Um botão "Excluir Linhas" permite ao usuário remover as notas selecionadas.
    - **Recálculo Automático:** Ao clicar no botão, as linhas selecionadas são removidas da visualização e todos os totais (por filial e o resumo geral) são recalculados e atualizados instantaneamente.
    - A exclusão é apenas na visualização; os dados originais não são perdidos até que um novo upload seja feito.

6.  **Impressão:**
    - Um botão "Imprimir Relatório" formata a página para uma versão otimizada para impressão, removendo elementos de interface como botões, a área de upload e as caixas de seleção.

7.  **Exportação para CSV:**
    - Um botão "Exportar para CSV" gera um arquivo CSV com os dados processados (incluindo as exclusões feitas), que pode ser aberto em planilhas como Excel ou Google Sheets.

## Correções e Melhorias

- **Resolução de Problema de Cache (Cache-Busting):**
    - **Problema:** Foi encontrado um erro persistente (`SyntaxError`) que impedia a aplicação de carregar. A causa foi identificada como um problema de cache no ambiente de desenvolvimento.
    - **Solução:** Adicionado um parâmetro de versão à tag `<script>` no `index.html` para forçar o navegador a carregar a versão mais recente do script.

- **Correção de Erro de Processamento de XML (`TypeError`):
    - **Problema:** A aplicação falhava ao processar arquivos XML de NFe que não continham a tag de motivo de cancelamento (`xMotivo`).
    - **Solução:** Adicionado o operador de "optional chaining" (`?.`) para evitar o erro, permitindo que o processamento continue de forma segura.

- **Correção de Sintaxe na Exportação para CSV:**
    - **Problema:** Um erro de sintaxe na função `exportToCsv` impedia a geração do arquivo CSV.
    - **Solução:** A linha de código que constrói a string do CSV foi corrigida, garantindo a junção correta do cabeçalho e das linhas com o caractere de nova linha (`\n`) e adicionando o BOM (`\uFEFF`) para compatibilidade com Excel.

## Plano de Refatoração Premium (V2)

**Visão Geral do Plano:**
Elevar o sistema a um patamar corporativo (SaaS Edge/Premium), adotando rigorosos padrões de engenharia de software no client-side e uma interface "WOW" usando design moderno.

**Passos Estratégicos:**
1. **Engenharia de Software (JS Moderno):**
   - **Solididade:** Separar a lógica de parsing de XML do `NfeReportGenerator` para uma camada própria de serviço (`NfeParserService`).
   - **Performance Assíncrona:** Trocar callbacks manuais `FileReader` por processamento limpo com `Promises` (`async/await`) e `Promise.all()`.
   - **Prevenção XSS:** Eliminar injeção via `html += ...` concatenado e adotar renderização segura por `DocumentFragment` e classes encapsuladas.

2. **UI/UX e Aesthetics (Efeito WOW - Baseline CSS):**
   - **Glassmorphism e Profundidade:** Aplicar sombras multifacetadas, cores vibrantes com paleta oklch, e efeitos de profundidade refinados imitando ferramentas nativas corporativas.
   - **Micro-interações Premium:** Substituir alertas nativos (`alert()`) por sistema elegante de *Toasts*.
   - **Estados Imersivos:** Melhorar drag-and-drop feedback visual e criar um Skeleton loader / barra de progresso fluida durante o parse do XML.
   - **Acessibilidade & Tipografia:** Consolidar escalonamento da fonte "Poppins", enfatizando totais em tamanho *hero* com alto contraste.

3. **Nova Funcionalidade: Velocidade de Venda e Dashboard Executivo**
   - **Painel de Gráficos Superior:** Quando o usuário inserir os arquivos, uma nova seção superior (*Dashboard Hero*) abrirá com visualização de dados focada em BI (Business Intelligence).
   - **Integração Gráfica (Chart.js):** Utilização de biblioteca terceira via CDN para renderizar Gráficos de Pizza/Doughnut exibindo o "Share de Faturamento por Filial" e o "Progresso da Meta Estipulada".
   - **Input de Meta Diária:** Campo elegante para o usuário definir seu alvo de vendas (R$).
   - **Indicadores Rápidos (KPIs):** Caixas informativas de leitura dinâmica mostrando percentuais de meta atingida, saldo restante, crescimento ou retração daquele mesmo saldo.

4. **Nova Regra de Negócio: Segregação Contábil (Receita vs. Movimentação)**
   - **Filtro de Natureza de Operação:** O sistema passa a ler a tag `<natOp>` (Natureza da Operação) do XML. 
   - Apenas notas contendo "Venda" ou "Locação" são somadas no KPI de Total Faturado, Dashboard Executivo e Velocidade de Vendas.
   - Operações como "Brinde", "Transferência", "Remessa", "Devolução" serão separadas e somadas em um extrato isolado chamado "Operações Sem Efeito de Caixa (Non-Revenue)", mantendo a contabilidade da meta limpa.

5. **Nova Funcionalidade: Responsividade Total (V3 - Mobile Experience)**
   - **Layout Adaptável:** Transição suave entre desktop (sidebar fixa) e mobile (menu hamburguer/sobreposição).
   - **Barra de Filtros Inteligente:** Reorganização automática dos filtros de uma grade horizontal para uma coluna em telas menores, utilizando Gap e Flexbox.
   - **Tabelas Responsivas:** Implementação de contêineres de rolagem horizontal para evitar quebras de layout em dispositivos móveis.
   - **Otimização de Espaçamento:** Ajuste de margens, paddings e tamanhos de fonte (unidades relativas) para maximizar a legibilidade em telas pequenas.
   - **Controle de Scroll:** Substituição de `overflow: hidden` por um sistema de scroll controlado no contêiner principal, garantindo acesso a todo o conteúdo.

## Plano de Ação Atual: Responsividade 100%

1.  **Refatoração do CSS Base:** Ajustar o `app-container` para gerenciar o layout de forma dinâmica com Media Queries.
2.  **Menu Mobile:** Criar um mecanismo de toggle para a sidebar em telas inferiores a 768px.
3.  **Filtros Adaptativos:** Transformar o `global-filter-bar` em um layout flexível ou grid multi-linha.
4.  **Gráficos e Tabelas:** Garantir que todos os componentes de visualização de dados redimensionem corretamente.
5.  **Ajustes de UI Final:** Polir sombras e bordas para telas pequenas, garantindo o "Efeito WOW" em qualquer dispositivo.
