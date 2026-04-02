# Blueprint: Gerador de Relatório de NFe (Elite BI Platform)

## Visão Geral

Esta aplicação é uma plataforma de Business Intelligence (BI) corporativa para o processamento de arquivos XML de Nota Fiscal Eletrônica (NFe) e integração de dados de faturamento. Ela permite a gestão estratégica através de dashboards em tempo real, auditoria fiscal detalhada e sincronização segura com a nuvem via Supabase.

## Estilo e Design (Elite BI Aesthetics)

- **Identidade Visual:** Design "Glassmorphism" com profundidade extrema, utilizando sombras suaves e camadas de transparência.
- **Paleta de Cores (Premium):** 
    - **Accent:** Teak/Ciano (#0d9488) com efeitos de brilho (Glow).
    - **Background:** Slate suave (#f8fafc) com textura sutil de ruído para toque tátil.
    - **Dark Mode Elements:** Sidebar e cabeçalhos mobile em Slate Profundo (#0f172a).
- **Tipografia:** Uso de "Inter" para dados técnicos e "Outfit" para títulos e KPIs de alto impacto.
- **Responsividade EXTREMA (V3):**
    - Layout adaptativo que alterna entre sidebar fixa (Desktop) e menu hambúrguer com overlay (Mobile).
    - Grid de KPIs que se ajusta automaticamente para 1, 2 ou 4 colunas.
    - Tabelas com scroll horizontal controlado e filtros que se empilham em telas menores.

## Regras de Negócio e Faturamento (Contabilização)

A aplicação utiliza uma lógica de whitelist estrita para a contabilização do faturamento (Receita), ignorando operações de movimentação simples:

1.  **Contabilizados como Receita:**
    - **VENDAS CONTRIBUINTES:** Identificado no XML através do destinatário com IE. (Tag Verde)
    - **VENDAS NÃO CONTRIBUINTES:** Identificado no XML através do destinatário isento/não-contribuinte. (Tag Amarela)
    - **SAÍDA DE LOCAÇÃO:** Operações de locação ou aluguel de equipamentos. (Tag Azul)

2.  **Operações de Movimentação (Não-Faturamento):**
    - **TRANSFERÊNCIA:** Remessas entre filiais.
    - **AMOSTRA/BRINDE:** Envio de materiais gratuitos.
    - **DEVOLUÇÃO/RETORNO:** Estornos e reconciliações.
    - **ENTRADAS:** O sistema filtra automaticamente notas de entrada, mesmo que sejam de venda, para não duplicar o faturamento.

## Funcionalidades de Engenharia

1.  **NfeParserService (JS Moderno):** Parsing assíncrono de XML e JSON utilizando `Promises.all` e `DOMParser`.
2.  **Dashboard Executivo:**
    - Gráficos dinâmicos (Chart.js) para Tendência Diária, Share por Unidade e Ranking de Vendedores.
    - Cálculo de Projeção de Faturamento (Forecast) baseado no ritmo atual de vendas.
3.  **Sincronização Cloud (Supabase):** Persistência de dados multi-filial com deduplicação por número de nota.
4.  **Offline-First:** Backup automático em `localStorage` para garantir disponibilidade mesmo sem internet.

---

### Instruções para Execução

1.  Abra o arquivo `index.html` diretamente em seu navegador (Chrome/Edge recomendado).
2.  Ou utilize um servidor estático local: `npx http-server ./`
3.  O sistema carregará automaticamente os dados da nuvem (Supabase) ou do backup local.
