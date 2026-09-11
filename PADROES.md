# Gestão em Movimento — PADRÕES DO PORTAL

**Documento de referência única.** Tudo o que foi construído até 10/09/2026 e que vale como padrão: casca, filtros, gráficos, tabelas, exportação, fontes de dados, banco, robôs, acessos, publicação. Foi montado por varredura do código (72 painéis, 18 assets compartilhados mais o farol-core, 73 scripts, 71 workflows, 35 arquivos SQL), não de memória. Onde o texto diz "medido" ou "conferido", o número saiu do arquivo.

Os documentos anteriores (`README.md`, `PAINEIS.md`, `HANDOFF.md`, `DOCUMENTACAO-TI.md`, `ESTADO-DO-PROJETO.md`, `MIGRACAO-PRODUCAO.md`, `TERMOMETRO.md`) são de maio a julho de 2026 e estão desatualizados. Este substitui todos. O `CLAUDE.md` continua sendo o diário de decisões, com o histórico e os porquês; este aqui é o **estado atual**, organizado por assunto.

A tabela de inventário (seção 3) é gerada por `scripts/padroes-inventario.mjs`. Para atualizar depois de mexer num painel:

```
node scripts/padroes-inventario.mjs
```

---

## 0. Índice

1. O portal em uma página
2. Regras que não se negociam
3. Inventário dos painéis (gerado)
4. Casca padrão (layout novo)
5. Casca antiga (o que os 42 painéis não migrados usam)
6. Filtros multi-select
7. Gráficos
8. Tabelas
9. Números, datas e vigências
10. Assets compartilhados (o que cada arquivo faz e a ordem de inclusão)
11. Exportação: Excel, PNG e PDF
12. Fontes de dados: Google Sheets
13. Fontes de dados: Supabase (tabelas, funções, RLS)
14. Fontes de dados: APIs e robôs (Ginfo, Prolog, Geotab, vFleets, ERP)
15. Autenticação, perfis e acessos
16. Workflows do GitHub Actions
17. Módulos com regra própria (FCA, Planner, Gerot/Frota de Elite, Farol, Disponibilidade, DriverPro, Carta de Custos, Seara, Combustível, Painel de Metas)
18. Publicação: build, cache, PR e branch
19. Chaves de localStorage e sessionStorage
20. Pendências conhecidas

---

## 1. O portal em uma página

- **O que é:** o BI da Fortes Indicadores para a frota da Conlog, substituindo o Looker Studio. Cada painel é um `index.html` autocontido: sem framework, sem build, sem backend próprio. Hospedado no **GitHub Pages**.
- **Repositório:** `fortesindicadores-byte/gestao-em-movimento` (renomeado de `Projeto-BI-App`). Branch de publicação: `main`. Deploy automático no push.
- **URL:** `https://fortesindicadores-byte.github.io/gestao-em-movimento/` → `/<pasta>/`.
- **Hub:** `index.html` da raiz. Login pelo Supabase Auth, aprovação de usuário, lista de painéis em **clusters** (Administração · Planejamento Estratégico · Visão Geral · Financeiro · Operacional · Processos · Resultados), busca, tema. Um cluster por vez na lateral; a busca vale sobre todos.
- **Banco:** um projeto Supabase (`lozwipoeacpvplgkrxkq`). O HTML público só carrega a chave **publishable** `sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9`. A service key mora só nos Secrets do GitHub (`GEM_SUPABASE_SERVICE_KEY`) e nunca no HTML.
- **Dados:** três origens. (1) Google Sheets lido por gviz no navegador, acelerado pelo `gviz_snapshot`; (2) tabelas do Supabase, gravadas por robôs do Actions ou pelos próprios apps (FCA, Planner, Disponibilidade, Carta de Custos, DriverPro); (3) bases tipadas `sh_*` carregadas do Sheets de hora em hora (migração em curso: só o Km/L lê delas hoje).
- **Robôs:** GitHub Actions com Playwright (Ginfo/Power BI, Frota de Elite), fetch (gviz, Sheets → `sh_*`, Prolog, ERP), coletor de telemetria (Geotab/vFleets). Todos gravam no Supabase com a service key.
- **Quem manda:** o Renan (admin). As regras dele estão na seção 2 e valem acima de qualquer padrão técnico.

---

## 2. Regras que não se negociam

1. **TUDO QUE O RENAN VAI RODAR VEM COLADO NO CHAT.** SQL, query, Apps Script, comando. Apontar o caminho do arquivo no repositório não conta. Versionar o arquivo continua certo, mas o conteúdo aparece inteiro no chat. A única dispensa é quando o assistente consegue executar por si (workflow, commit).
2. **DIRETO NO OFICIAL E PUBLICADO NA HORA.** Não existe etapa de validação. Mexer no painel oficial, fazer o merge no `main` e avisar que publicou. PR parado em rascunho não existe: se não está no `main`, não existe.
3. **NÃO INVENTAR, NUNCA.** Migrar um painel é trocar a apresentação pela do padrão, não redesenhar. Nada de componente que não existia no painel antigo e não está no padrão. Se algo parece faltar, perguntar antes.
4. **NADA DE FUNÇÃO QUE SOME NA RECONSTRUÇÃO.** Excel, PNG, PDF, ordenação, mobile: tudo que o painel antigo tinha continua no novo. Antes de promover uma versão, comparar a lista de `<script src>` da antiga com a da nova e explicar cada ausência.
5. **Nada de rolagem em desktop na casca padrão.** Se não coube, encolhe fonte/padding ou divide em mais visões.
6. **A primeira visão de todo painel chama-se "Resumo Gerencial".** Nomes de visão em português curto: Análise Nominal · AH e AV · YTG + TGT · Bridge/Cenário 1/Cenário 2 · Forecast.
7. **O repositório é público.** Logs do Actions não podem imprimir nome, CPF/CNH, token ou chave. Nenhum segredo entra no HTML.
8. **Fundo é UNIFORME, não degradê.** `#202022`/`#121214` no escuro, `#E1E2E5` no claro. A página é mais escura que o painel; é essa diferença que faz o app flutuar. Ao mexer, medir os dois pixels.
9. **Cards usam `--side`**, o mesmo tom da lateral. Não mexer no valor de `--side` para ganhar contraste.
10. **Menus suspensos são OPACOS** (`--pop`). Filtro, seletor de unidades, dica da lateral.
11. **A sobra de altura é DIVIDIDA** entre cards e gráfico. Nunca `max-height:none` no `.gr2` numa visão que tem tabela embaixo; o gráfico leva teto (`44vh`, `56vh` quando é o miolo) e a fileira de cards ganha altura própria.
12. **Eixo Y justo ao pico:** `suggestedMax ≈ pico × 1,12`. Gráfico alto e vazio é erro.
13. **Série condicional (verde/vermelho) tem legenda NEUTRA.**
14. **Cabeçalho de tabela alinhado com o conteúdo:** texto à esquerda, número à direita. **Nunca barra de rolagem horizontal** em desktop.
15. **`(INATIVO)` nunca aparece** em nenhuma tela (vassoura global no `mobile.js`; nos dados, `scripts/limpar-inativo.sql`).
16. **O "Gerar PDF" fica em ATALHOS, na lateral.** Um slide por visão, painel inteiro com a lateral recolhida.
17. **Não refazer o gráfico de barra como arquivo global.** `assets/grafico-barra.js` foi feito e revertido no mesmo dia (09/09/2026). Se o padrão voltar, é painel por painel, com o Renan olhando cada tela.
18. **Toda tabela nova com `unidade` usa `fca_has_unit()`, nunca `= fca_my_unit()`.** O perfil pode ter várias unidades separadas por vírgula.
19. **Bump do build a cada mudança de painel:** `<meta name="build" content="AAAAMMDDHHMM">` e `build-check.js?v=` iguais.
20. **Commits e PRs** terminam com a atribuição da sessão (ver seção 18). Nenhum identificador de modelo em código, commit ou PR.

---

## 3. Inventário dos painéis (gerado)

Legenda: **Casca** padrão = `.app`+`.side`/`.board` (layout novo) · antiga = `.header`+`.main` · app próprio = DriverPro. **Fontes** `Sheets:` workbook por apelido (ver seção 12) · `sb:` tabela do Supabase · `rpc:` função · `ginfo:` chave do `ginfo_snapshot`. **Filtros** = quantidade de `.ms-wrap`. Painéis que não aparecem no hub estão marcados na seção 3.1.

| Pasta | Título | Casca | Tema | Fontes | Filtros | Gráficos | Tabela | Exporta | Build |
|---|---|---|---|---|---|---|---|---|---|
| `_template/` | Nome do Painel — Subtítulo | antiga | — | — | 1 | — | — | — | — |
| `acessos/` | Acessos · Gestão em Movimento | padrão | claro | sb:access_log | 3 | bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `app-motorista-3/` | Condução Econômica | app próprio | — | — | 0 | — | — | — | 202609061030 |
| `app-motorista-4/` | DriverPro | app próprio | claro | — | 0 | — | — | — | 202609101500 |
| `app-motorista-5/` | DriverPro | app próprio | claro | — | 0 | — | — | — | 202609101500 |
| `app-motorista/` | Condução Econômica | app próprio | — | — | 0 | — | — | — | 202609061300 |
| `arvore-frota/` | Árvore de Custo da Frota · BI Frota | antiga | light-mode | Sheets:DRE, Sheets:Dispersão, Sheets:Seara | 5 | — | — | Excel/PNG · PDF · ordenação | 202608192100 |
| `ativos/` | Ativos · Gestão em Movimento | padrão | claro | sb:ginfo_snapshot, ginfo:ativos | 7 | bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `auditorias/` | Auditorias | antiga | light-mode | Sheets:Termômetro | 0 | — | tbl-section | Excel/PNG · PDF · ordenação | 202608192100 |
| `carta-custos-teste/` | Carta de Custos · Teste | antiga | light-mode | Sheets:DRE, sb:carta_custos | 3 | bar+doughnut | dre | Excel/PNG · ordenação | 202609092400 |
| `carta-custos/` | Carta de Custos | padrão | claro | Sheets:DRE, sb:carta_custos | 8 | bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `catalogo-pecas-externo/` | Catálogo de Peças — Frota | antiga | light-mode | — | 0 | — | — | — | 202608180700 |
| `catalogo-pecas/` | Catálogo de Peças · BI Frota | antiga | light-mode | — | 0 | — | — | — | 202608180700 |
| `combustivel/arvore-combustivel/` | Árvore de Combustível · BI Frota | antiga | light-mode | Sheets:Dispersão, Sheets:DRE, Sheets:Consumo | 4 | — | — | Excel/PNG · PDF · ordenação | 202609081200 |
| `combustivel/co2/` | CO² — Emissões da Frota | antiga | light-mode | Sheets:Consumo | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `combustivel/conducao-economica/` | Condução Econômica · Gestão em Movimento | padrão | claro | sb:ginfo_snapshot, sb:ce_motoristas, sb:ce_app_log, sb:ce_scores_mensais, ginfo:ativos | 4 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `combustivel/eficiencia-kml/` | Km/L — Eficiência de Combustível | antiga | light-mode | Sheets:Consumo, sb:sh_consumo_km_litro | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609101610 |
| `combustivel/` | Combustível · Gestão em Movimento | — | — | — | 0 | — | — | — | 202608192100 |
| `combustivel/preco-litro/` | R$/L — Preço do Combustível | antiga | light-mode | Sheets:Consumo | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `combustivel/seara/arvore/` | Árvore de Combustível Seara · BI Frota | antiga | light-mode | Sheets:DRE, Sheets:Seara | 2 | — | — | Excel/PNG · PDF · ordenação | 202608192100 |
| `combustivel/seara/eficiencia/` | Km/L Seara — Eficiência de Combustível | antiga | light-mode | Sheets:Seara | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `combustivel/seara/` | Combustível Seara · Gestão em Movimento | — | — | — | 0 | — | — | — | 202608192100 |
| `combustivel/seara/preco-litro/` | R$/L Seara — Preço do Combustível | antiga | light-mode | Sheets:Seara | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `comparativo-equipamento/` | Lifecycle da Carreta — R$/Equipamento | antiga | light-mode | Sheets:Tendência | 0 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `comparativo-km/` | Lifecycle da Carreta — R$/km | antiga | light-mode | Sheets:Tendência | 0 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `comparativo-optas/` | Comparativo OPTAS — Carroceria | antiga | light-mode | Sheets:Tendência | 0 | line+bar | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `conferencia-locacao/` | Conferência de Locação · Gestão em Movimento | padrão | claro | sb:locacao_benner, sb:locacao_modelos, sb:locacao_obs, sb:locacao_conferencia | 1 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `consumo-kml-analise/` | Km/L — Análise do Impacto (storytelling) | antiga | light-mode | Sheets:Consumo | 7 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `controle-ficticio/` | Controle Financeiro · Rafael & Camila | antiga | light-mode | — | 2 | line+bar | — | ordenação | 202609092400 |
| `diagnostico/` | Diagnóstico | antiga | light-mode | Sheets:RPM, Sheets:Termômetro, ginfo:civf | 2 | — | — | Excel/PNG · PDF | 202608240300 |
| `disponibilidade-migracao/` | Disponibilidade · Migração | antiga | light-mode | Sheets:Termômetro, sb:disp_snapshot, sb:indisp_snapshot, ginfo:ativos | 0 | — | — | ordenação | — |
| `disponibilidade-preenchimento/` | Disponibilidade · Frota do Dia | padrão | claro | sb:ginfo_snapshot, sb:ativos_manual, sb:indisponibilidade, sb:disp_checkins, sb:disp_dias, sb:indisp_snapshot, sb:disp_snapshot, rpc:disp_refoto_hoje, ginfo:ativos | 0 | bar | — | Excel/PNG · ordenação | 202609092400 |
| `disponibilidade/` | Disponibilidade · BI Frota | antiga | light-mode | Sheets:Termômetro, ginfo:ativos | 5 | line+bar | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `eficiencia-ativacao/` | Ativação de Frota · BI Frota | antiga | light-mode | Sheets:Dispersão | 4 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `farol-frota/` | Farol Frota — Gestão em Movimento | antiga | — | — | 0 | — | — | — | 202608192100 |
| `fca-consolidado/` | FCA · Admin | padrão | claro | sb:fca | 11 | — | tbl-section | Excel/PNG · ordenação | 202609011100 |
| `fca-gerencial/` | FCA Gerencial | antiga | light-mode | Sheets:Termômetro, sb:fca | 6 | bar | dre | ordenação | 202609092400 |
| `fca-migracao/` | FCA · Migração | antiga | light-mode | Sheets:Termômetro, sb:fca | 0 | — | — | ordenação | 202608192100 |
| `fca-preenchimento/` | FCA | padrão | light-mode | Sheets:RPM, Sheets:Termômetro, Sheets:DRE, Sheets:Consumo, Sheets:Dispersão, sb:fca | 7 | — | — | Excel/PNG · ordenação | 202609101700 |
| `fca/` | FCAs | antiga | light-mode | Sheets:Termômetro, sb:fca | 1 | — | tbl-section | ordenação | 202608192100 |
| `financeiro-pessoal/` | Controle Financeiro · Renan & Tati | antiga | light-mode | — | 2 | line+bar | — | Excel/PNG · PDF · ordenação | 202609092400 |
| `footprint-goiania/` | Footprint Goiânia · Gestão em Movimento | padrão | claro | sb:footprint_check | 0 | — | dre | Excel/PNG · PDF · ordenação | 202609081800 |
| `forecast/` | Forecast Editável — Frota | antiga | claro | Sheets:DRE, sb:forecast_scenarios | 2 | bar | dre | Excel/PNG · ordenação | 202609092400 |
| `gerot/` | Gerot | antiga | light-mode | — | 2 | — | tbl-section | Excel/PNG · PDF · ordenação | 202608240300 |
| `gestao-a-vista/` | Gestão à Vista | padrão | claro | sb:elite_snapshot, sb:fca | 1 | — | dre | Excel/PNG · PDF · ordenação | 202609101830 |
| `governanca/` | Estratégia e Governança | antiga | light-mode | — | 0 | — | — | — | 202608242200 |
| `hub-classico/` | Gestão em Movimento · BI Hub (clássico) | padrão | claro | sb:user_approvals, rpc:delete_user_by_id | 0 | — | — | — | 202608281545 |
| `/` | Gestão em Movimento · BI Hub | padrão | claro | sb:sh_base, sb:sh_pedido, sb:user_approvals, rpc:delete_user_by_id | 0 | — | — | — | 202609101340 |
| `manutencao/` | Manutenção — Detalhamento por NF | antiga | light-mode | Sheets:Manutenção | 10 | bar | tbl-section | ordenação | 202609092400 |
| `missao-visao-valores/` | Redirecionando… | — | — | — | 0 | — | — | — | 202608192100 |
| `mpr/` | MPR — Monthly Performance Review | antiga | light-mode | Sheets:Termômetro-tiers, sb:mpr_fields | 4 | — | tbl-section | ordenação | 202608192100 |
| `painel-km/` | Painel KM · Gestão em Movimento | padrão | claro | Sheets:Dispersão, Sheets:DRE | 4 | line+bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `painel-metas-diretor/` | Painel de Metas — Diretoria | antiga | light-mode | Sheets:Metas Diretor | 1 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `painel-metas/` | Painel de Metas | antiga | light-mode | Sheets:Termômetro, Sheets:Dispersão, Sheets:DRE, sb:fca | 1 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609102130 |
| `papeis-responsabilidades/` | Papéis e Responsabilidades | antiga | light-mode | — | 0 | — | tbl-section | Excel/PNG · ordenação | 202609101800 |
| `planner-corporativo/` | Planner Corporativo | padrão | claro | sb:planner, sb:user_approvals | 0 | — | — | Excel/PNG · ordenação | 202609011100 |
| `planner-teste-2/` | Painel de Gestão · Laranja | padrão | claro | sb:planner, sb:user_approvals | 0 | — | — | ordenação | 202608311500 |
| `planner-teste/` | Painel de Gestão · Planner | padrão | claro | sb:planner, sb:user_approvals | 0 | — | — | ordenação | 202608311500 |
| `pneus/` | Gestão de Pneus | — | — | — | 0 | — | — | — | 202608192100 |
| `preventivas-seara/` | Preventivas Seara · BI Frota | padrão | claro | sb:ativos_manual, sb:preventiva_lanc, sb:hodometro_leitura | 0 | bar | — | Excel/PNG · ordenação | 202609092400 |
| `programa-reconhecimento/` | Frota de Elite · BI Frota | antiga | light-mode | sb:portal_flags, ginfo:civf | 1 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `resumo-executivo/` | Resumo Executivo | antiga | light-mode | Sheets:RPM, Sheets:DRE, Sheets:Dispersão, Sheets:Consumo, Sheets:Termômetro, ginfo:civf | 1 | — | — | Excel/PNG · PDF | 202608240300 |
| `rs-por-km/` | R$/KM — Frota | antiga | light-mode | Sheets:DRE, Sheets:Dispersão, Sheets:Seara | 5 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `scorecard/` | Scorecard · Gestão em Movimento | padrão | claro | Sheets:RPM, Sheets:DRE, Sheets:Consumo, Sheets:Dispersão, Sheets:Termômetro, ginfo:civf | 2 | bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `seara-km/` | Painel KM · Seara · Gestão em Movimento | padrão | claro | Sheets:Seara | 4 | line+bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `suprimentos-padronizacao/` | Padronização de Itens — Frota / Suprimentos | antiga | light-mode | — | 0 | — | tbl-section | Excel/PNG · ordenação | 202608192100 |
| `tendencia-frota/` | Tendência R$/km & R$/Equipamento — Frota | antiga | light-mode | Sheets:Tendência | 0 | bar+line | tbl-section | Excel/PNG · PDF · ordenação | 202609092400 |
| `termometro/` | Termômetro — BI Frota | antiga | light-mode | Sheets:Termômetro-tiers | 4 | bar | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `visao-financeira-arvore/` | Visão Financeira · DRE Frota | padrão | claro | Sheets:DRE, Sheets:Dispersão, Sheets:Seara | 10 | bar+line | dre | Excel/PNG · ordenação | — |
| `visao-financeira-cheia/` | Visão Financeira · tela cheia (teste) | padrão | claro | Sheets:DRE | 10 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `visao-financeira/` | Visão Financeira · DRE Frota | padrão | claro | Sheets:DRE | 10 | bar+line | dre | Excel/PNG · PDF · ordenação | 202609092400 |
| `ytg/` | YTG + Target — Frota | antiga | claro | Sheets:DRE | 2 | bar | dre | Excel/PNG · ordenação | 202609092400 |

### 3.1 O que aparece no hub e o que não aparece

**No hub (array `CLUSTERS` no `index.html`):**

| Cluster | Card → pasta | Restrição |
|---|---|---|
| Administração | Gerenciar Acessos (tela interna) · Acessos `acessos/` · Conferência de Locação `conferencia-locacao/` · Footprint Goiânia `footprint-goiania/` · Bases do Sheets (janela interna) · Saúde do Ecossistema `saude/` | cluster só admin |
| Planejamento Estratégico | Estratégia e Governança `governanca/` · Papéis e Responsabilidades `papeis-responsabilidades/` | |
| Visão Geral | Scorecard `scorecard/` · Diagnóstico `diagnostico/` · Resumo Executivo `resumo-executivo/` · Ativos `ativos/` · Gestão à Vista `gestao-a-vista/` | |
| Financeiro | Visão Financeira `visao-financeira/` · Painel KM `painel-km/` · R$/KM `rs-por-km/` · Árvore de Custo da Frota `arvore-frota/` · Carta de Custos `carta-custos/` | |
| Operacional | Ativação de Frota `eficiencia-ativacao/` · Combustível `combustivel/` (sub-hub) · Pneus `pneus/` · Termômetro `termometro/` · Manutenção `manutencao/` · Preventivas Seara `preventivas-seara/` · Catálogo de Peças `catalogo-pecas/` | Preventivas Seara só para a unidade ANG |
| Processos | Gerot `gerot/` · Auditorias `auditorias/` · FCA `fca-preenchimento/` · Indisponibilidade `disponibilidade-preenchimento/` · MPR `mpr/` · Planner Corporativo `planner-corporativo/` | Planner só admin |
| Resultados | Programa de Reconhecimento `programa-reconhecimento/` · Aderência ao FCA `fca-gerencial/` · Painel de Metas `painel-metas/` | |

**Sub-hub Combustível (`combustivel/`):** Árvore de Combustível `arvore-combustivel/` · Eficiência Km/L `eficiencia-kml/` · Preço R$/L `preco-litro/` · Emissões CO² `co2/` · Condução Econômica `conducao-economica/` (só admin) · Seara `seara/` → sub-sub-hub com Árvore `seara/arvore/` · Eficiência `seara/eficiencia/` · Preço R$/L `seara/preco-litro/`.

**Fora do hub (acesso direto pela URL):** `financeiro-pessoal/` e `controle-ficticio/` (pessoais; não entram no snapshot compartilhado) · `seara-km/` · `forecast/` · `ytg/` · `tendencia-frota/` · `comparativo-km/` · `comparativo-equipamento/` · `comparativo-optas/` · `consumo-kml-analise/` · `suprimentos-padronizacao/` · `catalogo-pecas-externo/` · `painel-metas-diretor/` · `farol-frota/` (só admin; e-mail semanal) · `fca/` e `fca-consolidado/` e `fca-migracao/` (admin) · `disponibilidade/` (painel antigo do Sheets, a aposentar) · `disponibilidade-migracao/` · `hub-classico/` (hub anterior, guardado) · `missao-visao-valores/` (redireciona) · `visao-financeira-arvore/` e `visao-financeira-cheia/` (variantes de teste) · `carta-custos-teste/` · `planner-teste/` e `planner-teste-2/` (rodam em localStorage pelo `planner-teste-shim.js`) · `app-motorista*/` (DriverPro; a versão viva é a `app-motorista-4/`, espelhada no repositório `fortesindicadores-byte/driverpro` e servida em `driverpro.onespot.com.br`; a `-5` é a cópia em Montserrat) · `_template/` (modelo da casca antiga).

---

## 4. Casca padrão (layout novo)

Referência viva: **`visao-financeira/index.html`** (painel completo) e **`index.html` da raiz** (a mesma casca sem lateral). Método de migração: extrair o CSS da casca da Visão Financeira por script (do `<style>` até `/* ── YTG + TGT ── */` mais o bloco `@media(max-width:860px)`), colar a lógica de dados do painel antigo inteira e trocar só a apresentação.

### 4.1 Tokens

```css
:root{                                   /* escuro */
  --fundo: radial-gradient(80% 60% at 90% 0%, rgba(255,244,232,.035) 0%, transparent 60%),
           linear-gradient(45deg, #121214 0%, #121214 100%);   /* UNIFORME */
  --luz:      inset 0 1px 0 rgba(255,255,255,.09);
  --luz-card: inset 0 1px 0 rgba(255,255,255,.08);
  --app:      rgba(150,185,255,.045);   /* o .app CLAREIA a página no escuro */
  --side:     rgba(30,30,30,.50);       /* lateral E cards */
  --linha:    rgba(255,255,255,.06);
  --card:     rgba(44,44,46,.78);
  --brilho:   linear-gradient(180deg, rgba(255,255,255,.022) 0%, rgba(255,255,255,0) 46%);
  --card-brd: rgba(255,255,255,.07);
  --txt:#EEF2FA; --txt2:#B2BCD2; --txt3:#676F83; --txt4:#4C505C;
  --hover:    rgba(255,255,255,.06);
  --azul:#2E90E8; --verde:#3BB33B; --vermelho:#FF5252; --laranja:#F97316; --ambar:#F4A100; --cinza:#5B657C;
  --cabec:    #2B2B30;                  /* cabeçalho de tabela e totalizadores */
  --pop:      #26262B;                  /* menus suspensos: OPACOS */
}
body.claro{
  --fundo: radial-gradient(80% 60% at 90% 0%, rgba(255,255,255,.35) 0%, transparent 60%),
           linear-gradient(45deg, #E1E2E5 0%, #E1E2E5 100%);
  --luz: inset 0 1px 0 rgba(255,255,255,.9); --luz-card: inset 0 1px 0 rgba(255,255,255,1);
  --app: rgba(255,255,255,.20); --side: rgba(255,255,255,.50); --linha: rgba(15,23,42,.10);
  --card: rgba(255,255,255,.74); --brilho: linear-gradient(180deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 46%);
  --card-brd: rgba(15,23,42,.10);
  --txt:#161D2B; --txt2:#4A5568; --txt3:#737D91; --txt4:#8B94A6;
  --hover: rgba(15,23,42,.05);
  --azul:#1B6FC4; --verde:#00B300; --vermelho:#FF0000; --ambar:#E9A400; --cinza:#939CAF;
  --cabec:#DCDFE6; --pop:#FFFFFF;
}
```

As cores são **translúcidas de propósito**: é o empilhamento `--fundo` → `.app` (com blur) → `--side`/`--card` (com blur próprio e `--luz-card`) que dá o vidro. Hex chapado mata o efeito. **Tema claro é a classe `body.claro`** (a casca antiga usa `body.light-mode`). `--verde`/`--vermelho` ficam **fortes** no claro porque o tom pastel some sobre branco.

### 4.2 Estrutura

```
html,body{height:100%;overflow:hidden}      ← a página NÃO rola
body::after                                  ← textura de grão (SVG feTurbulence, opacity .5)
.app{position:absolute;inset:16px;display:flex;border-radius:10px;overflow:hidden;
     border:1px solid rgba(255,255,255,.10);box-shadow:0 28px 70px rgba(0,0,0,.55), var(--luz)}
.app::before{background:var(--app)}          ← a camada que clareia o miolo
  aside.side                                 ← lateral (264px · .mini = 64px)
    .s-top   (ícone + <b>nome do painel</b> + button.s-mini#btMini)
    .s-sec   "Visões"  → button.s-item[data-vw] (ícone 14px + rótulo; .on = ativo)
    .s-sec   "Atalhos" → div#pdf-slot · button.s-item "Atualizar dados"
    .s-user  (.av iniciais + <b>nome</b><i>subtítulo</i> + a.s-sair href="../")
  main.board
    .top     (.tit-wrap → h1#tit + .tit-sub#titSub · .filtros → .ms-wrap × N · button.tool.ico#btTema)
    .cols    → section.vw#vw-<chave>  (.on = visível; uma por visão)
```

A sombra forte do `.app` vale nos dois temas. O `.s-user .av` precisa da regra própria para não virar elipse (o `.s-user div{flex:1}` vence pela especificidade).

### 4.3 Lateral: medidas e comportamento

- `.side{width:264px;padding:16px 10px 12px;backdrop-filter:blur(13px);box-shadow:var(--luz), 8px 0 28px rgba(0,0,0,.25)}` · `.side.mini{width:64px}`. Chave da lateral recolhida por painel: `<prefixo>_mini` (ex.: `vfa_mini`, `km_mini`, `sc_mini`, `fca_mini`, `planner_mini`, `gav_mini`, `cc_mini`, `disp_mini`, `ce_mini`, `at_mini`, `acs_mini`).
- `.s-sec` 10px caixa alta, `letter-spacing:1.1px`, `--txt3`. `.s-item` 12.5px/500, padding `7px 8px`, raio 7px; `.on` = `--hover` + `--txt` + 600. `.s-item .n` = contagem à direita em 11px `--txt3`.
- **Dica quando recolhido:** um `div.dica` `position:fixed` no `body`, posicionado por JS no `mouseenter` (top = centro do item, left = `right+10`). Fundo `--pop`.
- `.av` 24px, círculo laranja `#F97316`, texto `#2A1405` 9px/800.
- **Mobile (`@media(max-width:860px)`):** `body{overflow:auto}`; `.app` vira `position:static; flex-direction:column; sem borda e sombra`; a lateral vira **fileira horizontal** de pílulas (`.s-item` com borda e raio 20px; ativo = laranja preenchido); `.s-user,.s-top,.s-sec` somem; `.filtros` vira faixa própria que rola de lado; `.vw.on{display:block}`; `.kpis` em 2 colunas; `.gcard{height:300px}`; `.gr2{display:block}`.

### 4.4 Topo

`.top{padding:12px 24px 10px}` · `h1` 21px/600 `letter-spacing:-.3px` · `.tit-sub` 11px/600 `--txt3` (recebe o status: `JUL/26 · atualizado …`, ou `Dados de 10/09 16:10 · banco`). Botões `.tool` fantasma (transparente, hover `--hover`); `.tool.ico` para o tema (sol/lua `_SOL`/`_LUA`). Os filtros ficam à direita, antes do botão de tema.

### 4.5 Conteúdo: hero, KPIs, gráficos

```css
.vw{display:none;flex:1;min-height:0;flex-direction:column;gap:12px}  .vw.on{display:flex;overflow:auto}
.card{border:1px solid var(--card-brd);border-radius:12px;background:var(--side);backdrop-filter:blur(10px);box-shadow:var(--luz-card)}
/* hero: número solto, SEM card */
.fin-hero{display:flex;align-items:flex-end;gap:20px}   .hlbl 9.5px/700 caixa alta   .hval clamp(26px,3.6vh,40px)/800
.hdel{display:flex;gap:18px}  .hdel div 9px caixa alta --txt3  .hdel b 13px/800 --txt
/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;flex:0 0 auto}
.kpi{padding:19px 16px;border:1px solid var(--card-brd);border-radius:11px;background:var(--side)}
.kpi .kl 9.5px/700 caixa alta --txt3 · .kv 25px/800 --txt · .km 10.5px/600 --txt3
/* gráficos */
.gr2{flex:1 1 auto;min-height:190px;max-height:44vh;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gcard{padding:12px 16px 10px;display:flex;flex-direction:column}  .gtit 12px/800  .gsub 10px --txt3  .gcv{flex:1;min-height:0;position:relative}
.gleg span 9.5px/700 --txt3 · .gleg i = tracinho (linha) · .gleg i.sq = quadradinho 9px (barra)
/* tela baixa (≤820px de altura, desktop) */ .kpi{padding:11px 14px} .kv 21px · .gr2{max-height:52vh}
```

Quando o gráfico é o último bloco da visão (`#vw-resumo .gr2{max-height:none}`), a sobra vai toda para ele porque `.kpis` é `flex:0 0 auto`. Quando há tabela embaixo, o teto fica. Botões de referência (`.rt`, pílula 20px, `REM`/`ORÇ`) e de dimensão (`.dimb`, `.on` = azul preenchido).

### 4.6 Tabela: ver seção 8.

### 4.7 JS da casca (contrato)

```js
const TIT={resumo:'Resumo Gerencial', nominal:'Análise Nominal', ...};     // chave da visão → título
function setVw(v){ VW=v; .s-item[data-vw].on ↔ .vw#vw-<v>.on; set('tit',TIT[v]); re-render do que precisa de canvas visível (setTimeout 30ms) }
function trocaMini(){ .side.mini toggle; localStorage '<prefixo>_mini'; re-render dos gráficos após 260ms }
function aplicaTema(t){ body.claro = t==='light'; localStorage tema; btTema = _LUA|_SOL; re-render dos gráficos }
function trocaTema(){ aplicaTema(claro ? 'dark' : 'light') }
document.querySelectorAll('.s-item[data-vw]').forEach(b=>b.addEventListener('click',()=>setVw(b.dataset.vw)));
```

Chave do tema: o hub grava **`bi_theme`** (chave compartilhada com a casca antiga, 120 usos no repositório). A Visão Financeira grava **`vfa_tema`**, o Pneus `pneus_theme`, o DriverPro `app4_theme`. Painel novo deve usar **`bi_theme`** para o tema seguir o hub.

Status de carga vai para `titSub`, não para badge. O botão "Atualizar dados" chama `recarregar()`, que **vai direto ao Google** (fora da janela do gviz-cache) e diz a fonte e a hora no `titSub`; falha com cache presente tem de aparecer, não travar em "Atualizando…".

### 4.8 PDF na lateral (obrigatório nos painéis migrados)

```html
<script src="../assets/pdf-export.js"></script>
<script>initPdfExport({ btnContainer:'#pdf-slot', btnClass:'s-item', btnAoFim:true,
  title:'Visão Financeira', subtitle:()=>document.getElementById('titSub').textContent, fileBase:'visao-financeira',
  main:()=>document.querySelector('.vw.on'),
  views:()=>Object.keys(TIT).map(k=>({label:TIT[k], ativar:()=>setVw(k)})),
  viewAtual:()=>VW, irPara:setVw,
  isLight:()=>document.body.classList.contains('claro'), setTheme:aplicaTema });</script>
```

O menu do PDF mora no `<body>` e é posicionado por JS (`position:fixed`): dentro do `.app`, que tem `backdrop-filter`, um `fixed` se ancora no `.app` e sai 34px do lugar.

### 4.9 Hub (a casca sem lateral)

`.marca` (quadrado laranja 34px + h1 21px + p 11px) · `.busca` (pílula 20px, 212px, `data-ctrlk`) · `.board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;overflow:auto}` · `.hcard{padding:19px 20px;border-radius:13px;background:var(--side);border:1px solid var(--card-brd);box-shadow:var(--luz-card);min-height:176px}` (hover: borda laranja + `translateY(-2px)`) · `.hcard .ic` 36px quadrado com laranja a 13%. Um cluster por vez (`gem_hub_clu`); a busca filtra todos os clusters. Cluster Administração e cards com `adm=true` só para admin; cards com `uni=[...]` só para quem tem a unidade.

Gerenciar Acessos: grade `repeat(auto-fill,minmax(430px,1fr))`, card com fundo `--side`, botões Remover/Bloquear absolutos no canto superior direito, seletores de Acesso FCA e Recebe Farol em `.farol-panel` opaco (`--pop`).

---

## 5. Casca antiga (42 painéis, `_template/index.html`)

É o que ainda está nos painéis não migrados. Não é o padrão para painel novo, mas é preciso saber ler.

```css
:root{--bg:#0C1017;--card:#141B26;--card2:#1A2335;--border:#1E2D40;--orange:#F97316;--blue:#38BDF8;
      --text:#F1F5F9;--text2:#94A3B8;--text3:#475569;--green:#3BB33B;--red:#FF6666}
body{background: radial-gradient(ellipse at 10% 25%,rgba(249,115,22,.06),transparent 50%),
                 radial-gradient(ellipse at 90% 75%,rgba(56,189,248,.05),transparent 50%), var(--bg);
     font:13px Montserrat; min-height:100vh}                  /* a página ROLA */
.header{position:sticky;top:0;background:rgba(12,16,23,.75);backdrop-filter:blur(20px);padding:10px 24px 12px}
  .brand h1 16px/700 laranja · .brand p 10px --text2
  .header-right → .theme-btn · .refresh-btn · .status-badge#status-badge · .access-badge#access-badge
  .header-filters (flex-basis:100%) → .filter-group → .ms-wrap
.main{padding:20px 24px}            /* sem max-width nem margin:0 auto (regra) */
.cards-row{grid 5 colunas;gap:12px} .kpi-card{background:rgba(20,27,38,.55);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:14px 16px;backdrop-filter:blur(16px)}
  .card-label 10px/600 caixa alta · .card-value 24px/800 · .card-delta-v 20px/800 · .card-delta-p 12px/600 · .card-imp 10px
.hero (fora de card) .hero-label 10px/600 · .hero-value 52px/800 · .hero-delta b 14px/700
.charts-row{grid 1fr 1fr;gap:16px} .chart-card{padding:16px} .chart-title 15px/800 caixa alta · .chart-wrap{height:230px}
.tbl-section{background:rgba(20,27,38,.55);border-radius:8px;padding:18px 20px 16px} .tbl-title 16px/800 · .tbl-sub 10px
```

- **Tema claro:** `body.light-mode` (`.main{background:#F0F0F0}`; cards brancos com `!important`). Header e filtros continuam escuros no claro. Botão sol/lua `#themeBtn` com `applyTheme(t)` e chave `bi_theme`.
- **Header com filtros:** `assets/filters-toggle.js` põe o botão "Filtros" que recolhe `.header-filters` no mobile (`body.filters-collapsed`) e encolhe os `.dim-toggle/.dim-btn`. **Esse script não entra na casca nova** (não há `.header-filters` lá).
- **Último acesso:** `initAccessLog()` com `bi_user_name` (prompt do nome), `bi_last_access`, `bi_last_user` e o `#access-badge`. Está em 50 painéis. Na casca nova o acesso é registrado no banco (`access_log`), não no localStorage.
- **Atualização:** `atualizar()` escreve `Atualizado dd/mm/aaaa hh:mm` no `#status-badge`; `setInterval` de 30 min; botão de refresh escondido no mobile.
- **Mobile:** `@media(max-width:768px)`; cards ficam 5 por linha com fonte 6.5–12px; gráficos empilham; tabelas em `font-size:1.6vmin` com `table-layout:fixed`.

---

## 6. Filtros multi-select

Mesma mecânica nas duas cascas; muda só o visual.

**Markup (casca nova):**

```html
<div class="ms-wrap" id="ms-uni"><button class="ms-btn" onclick="toggleMs('ms-uni')">
  <svg…/> Unidade<span class="ms-cnt"></span></button>
  <div class="ms-panel"><div class="ms-search"><svg…/><input type="text" placeholder="Pesquisar…"></div><div class="ms-list"></div></div>
</div>
```

**Mecânica (`_buildMs` + `buildMsFilter(id, items)`):**

- A seleção mora em `wrap._sel` (um `Set`). **`Set` vazio = "Todos"** (todos marcados na lista, contagem escondida).
- Opção "Todos" (`.ms-opt.all-opt` com `input.ms-all`): marcar limpa o `Set`. Desmarcar uma opção com o `Set` vazio põe **todas as outras** no `Set` (fica "todos menos esta"). Se depois de uma mudança o `Set` tiver todas as opções, ele volta a vazio.
- `span.ms-only` ("only", aparece no hover) seleciona só aquela.
- `.ms-search input` filtra a lista sem mexer na seleção; clique dentro não fecha o painel.
- `syncBadge(wrap)`: contagem na pílula laranja `.ms-cnt` e classe `.ativo` no `.ms-wrap` quando há seleção.
- `toggleMs(id)` fecha os outros painéis, abre este e foca a busca; clique fora de `.ms-wrap` fecha todos.
- `getMsValues(id)` devolve `[...wrap._sel]` (vazio = sem filtro). O painel chama `atualizar()` a cada mudança.
- `setMsOptions(id, items)` troca as opções mantendo o que ainda existe na seleção.

**Regras de conteúdo:**

- **Ano** é obrigatório e sempre o primeiro, populado a partir dos dados (`[...new Set(vigs.map(...))].sort().reverse()`).
- **Vigência:** só mês **com realizado**, do mais recente para o mais antigo, e o filtro abre no **último mês com realizado** (`buildVigMsFilter` da Visão Financeira, regra de 05/09/2026). A lista que desenha os gráficos continua com o ano inteiro (senão o orçado tracejado dos meses futuros some).
- Sequência típica: Ano · Vigência · Unidade · Projeto · Pacotes · Conta (Visão Financeira, 6 filtros). Painéis de IC: Vigência · Unidade. Painel KM: 4. Rótulos em português, sem jargão.
- Mobile antigo: 3 por linha com 6 filtros, 2 com 4, lado a lado com 2 (`.filter-group{flex:0 0 calc(33.333% - 4px)}`). Casca nova: faixa horizontal rolável.

**Visual:** casca nova = botão-texto fantasma (`.ms-btn` transparente, 12.5px/500, hover `--hover`), painel `--pop` opaco, raio 10px, sombra dupla, checkbox `accent-color:var(--azul)`. Casca antiga = botão `#0a0f18` com borda `#2a3a50`, 11px/700 caixa alta, painel `#0f1824`, checkbox laranja.

**Ctrl+K (`assets/ctrlk.js`):** foca `[data-ctrlk]`; senão o primeiro campo de busca visível; senão abre o primeiro `.ms-btn` e foca a busca do dropdown.

---

## 7. Gráficos

**Biblioteca:** Chart.js **4.4.0** (`chart.umd.min.js` do jsDelivr). Datalabels: `chartjs-plugin-datalabels@2.2.0` + `Chart.register(ChartDataLabels)` (em 16 painéis). Fonte sempre `Montserrat` em ticks, tooltip e rótulos.

### 7.1 Cores por tema (obrigatório, declarar ANTES de usar)

```js
const isLight=document.body.classList.contains('claro');          // 'light-mode' na casca antiga
const remC=isLight?'#161D2B':'#EEF2FA';                            // remunerado: texto forte
const orcC=isLight?'#1B6FC4':'#2E90E8';                            // orçado: azul
const tick={color:isLight?'#4A5568':'#B2BCD2',font:{family:'Montserrat',size:10}};
const tooltip={backgroundColor:isLight?'#FFFFFF':'#1B1B1E',titleColor:'#F97316',
  bodyColor:isLight?'#161D2B':'#EEF2FA',borderColor:isLight?'#d7dce4':'#33343A',borderWidth:1,
  titleFont:{family:'Montserrat'},bodyFont:{family:'Montserrat'}};
const verde='#3BB33B', vermelho=isLight?'#FF0000':'#FF5252';
```

`isLight` é `const` dentro da função de render: usar antes de declarar estoura (`const` antes da inicialização). Ao trocar o tema e ao recolher a lateral, **re-renderizar** os gráficos.

### 7.2 Gráfico de linha (Visão Financeira — receita, AV)

```js
// realizado = BARRAS condicionais (verde se ≤ referência, vermelho se >), ordem 2
dsReal = {type:'bar',data,backgroundColor:bg(.65|.85 foco|.2 fora),borderColor:bc,borderWidth:1,borderRadius:0,barPercentage:.97,categoryPercentage:.94,order:2}
// remunerado e orçado = LINHAS tracejadas, ordem 1
dsLin(data,label,c) = {type:'line',borderColor:c,borderWidth:2.5,tension:.3,fill:false,borderDash:[5,3],
  pointRadius:mkR(data), pointBackgroundColor:mkBg(data,c), pointBorderWidth:mkBw(data), order:1}
// pontos destacados (mês filtrado): radius 6, fundo branco, borda 3; demais 3/0
options: {responsive:true,maintainAspectRatio:false,layout:{padding:{top:22}},
  plugins:{legend:{display:false},tooltip},
  scales:{x:{ticks:tick,grid:{display:false},border:{display:false}},
          y:{beginAtZero:false,ticks:{...tick,maxTicksLimit:6,callback:cb},grid:{display:false},border:{display:false}, ...padBounds(...)}}}
plugins:[mkLabelPlugin(fmtFn, hlIdxs)]   // rótulo do valor só nos meses em foco, 700 11px, acima do ponto (y-8)
```

`padBounds(arrs, below=.12, above=.06)`: mínimo e máximo com folga proporcional à amplitude, arredondados a um passo de 1/2/5×10ⁿ; não cruza zero se os dados são positivos. **Sem grade, sem borda de eixo, sem legenda do Chart.js**: a legenda é o `.gleg` do card (tracinho = linha, quadradinho = barra, e a barra condicional tem legenda neutra).

### 7.3 Gráfico de barra (padrão escolhido pelo Renan em 09/09/2026: o do Painel KM)

```js
type:'line', datasets:[
  {type:'bar', label:'▲ REM %', data:deltaPct, backgroundColor: verde/vermelho pela META (alfa .65; foco .85; fora do foco .2),
   borderColor: verde/vermelho sólido, borderWidth:1, borderRadius:3, order:2},
  {type:'line', label:'META 5%', data:metaLine, borderColor:orcC, borderWidth:2, tension:0, borderDash:[5,3], order:1, ...mkPts(orcC,orcC)}],
options:{layout:{padding:{top:30}},
  plugins:{legend:{display:false}, tooltip,
    datalabels:{display: só a série de barra e só nos meses em foco, anchor:'end', align:'top', color:dlColor,
                font:{family:'Montserrat',size:isMobile?8:14,weight:'700'}, formatter:v=>(v>=0?'+':'')+v.toFixed(1)+'%'}},
  scales:{x:{grid, ticks:tick}, y:{display:false, beginAtZero:true}}}
```

Isto é: **barra colada** (`barPercentage` alto), **rótulo de dados no topo** (datalabels), **eixo Y escondido**, **sem grade**, cor **condicional pela meta** e linha de meta tracejada. Todo painel com barra deve olhar assim, mas a aplicação é **painel por painel** (a versão global foi revertida).

Barra simples de contagem (Acessos, casca nova): `backgroundColor:'#F97316', borderWidth:0, borderRadius:0, barPercentage:.92, categoryPercentage:.94`; rótulo por plugin próprio (`afterDatasetsDraw`, 800 10px, `pt.y-6`); `y:{beginAtZero:true, suggestedMax:Math.ceil(max*1.12), ticks:{precision:0,maxTicksLimit:4}, grid:{display:false}, border:{display:false}}`.

Waterfall (YTG + TGT): barras flutuantes `[de,até]`, `borderRadius:0`, `barPercentage:.72`, `y:{display:false,min,max}`, plugins próprios para rótulo e chave de esforço.

### 7.4 Outras formas em uso

- Donut (`doughnut`): só na Carta de Custos de teste.
- Calendário de calor do mês (Acessos e Indisponibilidade): grade de dias com escala em laranja, sem Chart.js.
- Heatmap/sparkline/gradiente laranja→roxo: pertencem às referências visuais dos layouts "Laranja Moderno", "2 Moderno" e "3 Moderno" (imagens em `docs/`), **não estão implementados**. O padrão escolhido é o descrito na seção 4.

### 7.5 Regras

- Eixo Y justo ao pico: `suggestedMax ≈ pico × 1,12`. Para Km/L (valores 2,0–2,1) o eixo abre para baixo por valor e amplitude: `piso=max(0,min(lo-rng*.45, lo*.82))`, `teto=max(hi+rng*.18, hi*1.04)`, arredondados a um passo de 0,1/0,5/1, com guarda para a barra nunca ser cortada.
- Destrua o gráfico antes de recriar (`if(ch) ch.destroy()`).
- `animation:false` nos gráficos que re-renderizam a cada filtro.
- Rótulo de dados sempre acima da barra/ponto, nunca dentro.
- Clique direito no `canvas` exporta PNG e, quando o painel expõe `chart.$exportAoA`, também Excel (ver seção 11).

---

## 8. Tabelas

### 8.1 Casca nova: `table.dre`

```css
.tsec{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 16px 12px}   /* card da tabela */
.ttit 14px/800 · .tsub 10px --txt3
.twrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--card-brd);border-radius:10px;background:var(--side)}
table.dre{width:100%;border-collapse:collapse;font-size:11px}
table.dre thead th{position:sticky;top:0;z-index:2;background:var(--cabec);padding:10px 12px;font-size:9.5px;font-weight:700;
  color:var(--txt2);text-transform:uppercase;letter-spacing:.7px;border-bottom:1px solid var(--card-brd);white-space:nowrap}
table.dre thead th .grp   ← rótulo de grupo acima do título da coluna (8.5px)
table.dre td{padding:9px 12px;border-bottom:1px solid var(--linha);color:var(--txt2);white-space:nowrap}
table.dre td.conta{color:var(--txt);font-weight:600;text-align:left}   table.dre td.num{text-align:right}
table.dre tbody tr:hover{background:var(--hover)}
table.dre tr.total td{font-weight:800;color:var(--txt);border-top:1px solid var(--card-brd);background:var(--cabec)}  /* totalizadores no tom do cabeçalho */
table.dre tr.ebitda-row td{font-weight:700;background:var(--cabec)}
table.dre tr.ref-row td{background:color-mix(in srgb,var(--azul) 8%,transparent)}
table.dre .sep-l{border-left:1px solid var(--card-brd)}                 /* separa blocos de colunas */
table.dre td.cr,.cr{color:var(--vermelho)!important;font-weight:700}   /* o !important é OBRIGATÓRIO */
table.dre td.cg,.cg{color:var(--verde)!important;font-weight:700}      /* idem cr-t / cg-t */
table.dre td.muted{color:var(--txt4)}
/* drill pacote → contas */
tr.pac-row{cursor:pointer}  td.conta::before{content:'+'} .open::before{content:'−'}  .no-drill::before{content:''}
tr.sub-row{display:none} tr.sub-row.show{display:table-row} tr.sub-row td.conta{padding-left:26px}
.pill (badge "fixo") · .esf-tag (esforço, verde; .hi = âmbar)
/* célula editável (forecast) */
td.edit{cursor:text;fundo laranja 7%;borda tracejada} td.edit:focus{anel} td.edit.changed{color:var(--laranja)!important;font-weight:700}
```

Ao focar `td.edit` mostra o número cru; ao sair, `parseNum` aceita `-2,87 mi`, `566k` e pt-BR.

### 8.2 Casca antiga: `.tbl-section` + `table`

`thead th` 11px/700 caixa alta, `border-bottom:1px solid rgba(255,255,255,.10)`; `td` 12px, `padding:13px 8px`, sem borda; `tr.total td` 12px/700 com `border-top:2px`; `td.num` à direita; hover `rgba(255,255,255,.035)`. Mobile: `table-layout:fixed`, `font-size:1.6vmin`.

### 8.3 Regras que valem nas duas

- Cabeçalho **alinhado com o conteúdo** (texto à esquerda, número à direita). A casca alinha tudo à direita por padrão; isso só serve para tabela numérica.
- **Nunca barra horizontal** em desktop: a tabela se ajusta; coluna que estoura vira dica na linha. `table-layout:fixed` com colunas dividindo a sobra (Footprint tem 16 colunas sem barra em 1366×768).
- Δ em BRL **e** em % em negrito; cores `cr/cg` para custo (gastou mais = vermelho) e o inverso para receita.
- **Ordenação:** `assets/sortable-table.js` ordena qualquer `<table>` pelo clique no cabeçalho, sobrevivendo a re-render (`MutationObserver`); exceções: `th` com `onclick`, `class="sortable"` próprio ou `data-no-sort` na tabela.
- **Mobile (`assets/mobile.js`):** tabela larga vira visão compacta (rótulo + Meta/Rem/Orç + Real + Δ%) com o botão **"+ Detalhar"** que abre a tabela completa com rolagem própria. Tabelas com células mescladas ficam inteiras atrás do botão. Nada muda no desktop.
- **PDF:** tabela que não coube na visão gera uma página extra com ela inteira (`tabelasCortadas()` detecta `scrollHeight > clientHeight`).

---

## 9. Números, datas e vigências

```js
const fmt  = v => { const neg=+v<0,a=Math.abs(+v); let s;
  if(a>=1e9) s=(a/1e9).toFixed(2)+' bi'; else if(a>=1e6) s=(a/1e6).toFixed(2)+' mi';
  else if(a>=1e5) s=(a/1e3).toFixed(2)+'k'; else s=Math.round(a).toLocaleString('pt-BR');
  return (neg?'-':'')+s; };
const fmtD   = v => (+v>0?'+':'')+fmt(v);
const pct    = v => v==null||!isFinite(v) ? '-' : (v>=0?'+':'')+v.toFixed(1)+'%';
const pctInt = v => v==null||!isFinite(v) ? '-' : (v>=0?'+':'')+Math.round(v)+'%';
const pp     = v => v==null||!isFinite(v) ? '-' : (v>=0?'+':'')+v.toFixed(2)+' pp';
const set    = (id,val) => { const e=document.getElementById(id); if(e) e.textContent=val; };
const colI   = (el,bad) => { if(el) el.style.color = bad ? 'var(--vermelho)' : 'var(--verde)'; };
setArr(el, text, sign, bad)   // ▲/▼ + texto, cor pelo sinal (ou pelo `bad` explícito)
```

Cor de resultado: **custo** `delta = rem − real; bad = delta > 0`; **receita** `deltaRec = real − ref; bad = deltaRec < 0`.

**Vigências — os formatos que existem e onde:**

| Formato | Onde | Parse |
|---|---|---|
| `Date(2026,7,1)` (texto do gviz) | qualquer aba com coluna de data | `parseD`: regex `^Date\((\d+),(\d+),(\d+)` → `new Date(a, m, d)` (mês já é 0-based) |
| `MM/AAAA` | `sh_*` (`vigencia`), `elite_snapshot`, filtros | `slice(-4)` para o ano |
| `mmm/aa` (`ago/26`) | `fca.vigencia`, rótulos de tela | `vigToDate`: `MESES.indexOf` + `2000+aa` |
| `AAAA-MM-DD` (`date` do Postgres) | `ce_scores_mensais.competencia`, `sh_*.vigencia_orig` | **montar por partes** `new Date(+a,+m-1,1)`; `new Date('2026-08-01')` é UTC e cai em 31/07 no Brasil |
| ISO com hora (`2026-08-01T03:00:00.000Z`) | cache de sessão (`JSON.stringify` transforma `Date`) | `parseVig` precisa do ramo ISO, senão na 2ª carga toda linha some |
| `MM_Q` (`08_2`) | termômetro (quinzena) | não é mês; não cobrar `MM/AAAA` |
| serial do Excel | exports xlsx do Ginfo | `parseFlex()` / serial → data |
| `janeiro de 2026` | aba Pneus do Frota de Elite | nome do mês |

`vigKeyN(d)=ano*100+mês` para ordenar; `vigLbl(d)='jan/26'`. Ordenar vigência **como texto** põe `ago` antes de `mai`: usar a chave numérica.

Regra de período dos robôs do Ginfo: **do dia 01 ao 10, mês = anterior**; Checklist usa o 3º dia útil; Frota de Elite roda do dia 01 ao 15 gravando o mês anterior.

---

## 10. Assets compartilhados

| Arquivo | O que faz | Quem inclui |
|---|---|---|
| `gviz-cache.js` (115 l) | No `<head>`. Intercepta `fetch` **e JSONP** ao `docs.google.com/.../gviz/tq` nos **primeiros 15 s** e responde do `gviz_snapshot` (Supabase) em ~200 ms. Snapshot com mais de **12 h**, Supabase lento (>1,2 s), chave fora da lista ou erro → vai ao Google. Chave: `"<sheet_id>|s=<aba>|g=<gid>|q=<tq>|h=<headers>"`, byte a byte igual à do robô. `window.GvizCache.{hits,misses}`. | todos os painéis que leem Sheets (financeiro-pessoal e controle-ficticio ficam fora de propósito) |
| `mobile.js` (230 l) | Trava de zoom (app-like), tabela larga → "+ Detalhar", vassoura do `(INATIVO)`. | **todas** as páginas |
| `ctrlk.js` (42 l) | Ctrl+K/⌘K foca a busca. | todas |
| `sortable-table.js` (301 l) | Ordenação por clique no cabeçalho em todas as tabelas. | todos os painéis com tabela |
| `excel-export.js` (412 l) | Clique direito em tabela (`.tbl-section/table`), gráfico (`canvas`) ou card (`.kpi-card/.card/.chart-card/.peso-box/.podio-section`) → "Exportar Excel" / "Exportar imagem (PNG)". Carrega SheetJS 0.20.3 e html2canvas 1.4.1 sozinho. Expõe `window.H2CPrep` (achatamento das camadas translúcidas, `normCor()` para `color-mix`, `semInset()` para sombras inset, `fundoDe(body)`). | todos com dado exportável; **antes** do pdf-export |
| `pdf-export.js` (354 l) | Relatório 16:9 em slides (html2canvas + jsPDF 2.5.2). `initPdfExport({...})`. Página 1 = capa (título, subtítulo, filtros aplicados, data); um slide por visão na casca nova; página extra para tabela cortada. Funciona nos dois layouts. | painéis com PDF (43) |
| `build-check.js` (78 l) | Registra o `sw.js` da raiz e, sem SW, confere o `<meta name="build">` contra o arquivo publicado a cada carga (máx. 3 recargas por sessão, `gem_reload_<path>`). Escreve `build <n>` em `[data-build]`. | todas (último script, com `?v=` igual ao build) |
| `swr-cache.js` (46 l) | Cache "pinta na hora" em **IndexedDB** (localStorage falha em silêncio acima de ~5 MB). | scorecard, diagnostico, gestao-a-vista |
| `gerot-base.js` (816 l) | Leitor do Frota de Elite/Gerot a partir do `elite_snapshot`. `GerotBase.{INDICADORES, INDICADORES_GEROT, METAS, atgDe, load({fundir}), acumFor(vigs), FUSAO, COD2UNIT, FIL2COD, unidadeFundida, fieldLabels, fieldOrder}`. | gerot, programa-reconhecimento, painel-metas, scorecard, diagnostico, resumo-executivo, fca-preenchimento |
| `aderencia-view.js` + `.css` (285 + 115 l) | Visão Aderência compartilhada (hero + KPIs + 2 gráficos + tabela) do FCA Gerencial embalada para Planner, FCA da unidade e FCA Admin. `AderenciaView.html({dims, tabela})`, `.htmlTabela`, `.render(container,{linhas,dim,aoTrocarDim})`. Linha: `{vig, concl, venc, dims}`. Métrica: `(concluídas×100 + andamento×50) ÷ total`. Faixas `--band-*` (fortes no claro): <70 vermelho, <85 âmbar, senão verde. | planner-corporativo, fca-preenchimento, fca-consolidado |
| `gantt-view.js` (159 l) | `GanttView.html(items)`; item `{id,label,tag,resp,status,start,end}`; barra criação→prazo na cor do status; rastro tracejado vermelho = atraso; linha "hoje". | planner, fca-preenchimento, fca-consolidado |
| `filters-toggle.js` (56 l) | Botão "Filtros" que recolhe `.header-filters` no mobile; encolhe `.dim-toggle`. **Só casca antiga.** | 29 painéis antigos |
| `catalogo-pecas-app.js` (832 l) + `-dados.js` + `-erp.js` | App do Catálogo de Peças (dados gerados da planilha "Lista de Peças – Frota V4.xlsx", 3,4 MB; não editar à mão). | catalogo-pecas, catalogo-pecas-externo |
| `planner-teste-shim.js` (168 l) | Substitui `window.supabase` por localStorage para o Planner de teste rodar sem tocar produção. | planner-teste, planner-teste-2 |
| `fundo.css` (56 l) | Imagem de fundo do hub no escuro (`img/fundo-conlog.jpg`). **Desligado** desde 10/08/2026 (link comentado). | ninguém |
| `farol-frota/farol-core.js` | Núcleo do Farol/Gestão à Vista: `farolLoad()`, `GADAPT` (adaptadores por chave do Ginfo), `DATA.{alinh,blitz,chk,cifv,custos,disp,os,pneus,prev,stressE,stressV,fonte,ginfoAtt}`, de-para `FIL2COD`/`refineCodG`. | farol-frota, gestao-a-vista |

**Ordem de inclusão (casca nova):** `gviz-cache.js` no `<head>` (antes de qualquer fetch) → CDNs (Chart.js, datalabels, supabase-js, html2canvas + jsPDF **no `<head>`** se houver PDF) → `gerot-base.js`/`swr-cache.js` quando usados → o `<script>` do painel → `mobile.js` → `sortable-table.js` → `excel-export.js` → `pdf-export.js` → `initPdfExport` → `build-check.js?v=<build>`.

Profundidade do caminho: `../assets/` em `/<pasta>/`, `../../assets/` em `/combustivel/<sub>/`, `../../../assets/` em `/combustivel/seara/<sub>/`.

---

## 11. Exportação: Excel, PNG e PDF

- **Excel/PNG** pelo botão direito (seção 10). Gráfico exporta Excel quando o painel preencheu `chart.$exportAoA` (matriz de linhas). Fora dos elementos exportáveis o menu nativo do navegador funciona.
- **PDF:** `initPdfExport` (opções na seção 4.8). Fundo do slide = tom uniforme da página (`H2CPrep.fundoDe(body)`); camadas translúcidas achatadas; menu suspenso no `<body>`.
- **Duas armadilhas do html2canvas 1.4.1** (corrigidas no `excel-export.js`): (1) **`color-mix()` aborta a captura** ("Attempting to parse an unsupported color function"); o `normCor()` converte o `color(srgb …)` computado em `rgba()`; (2) **`box-shadow: inset` vira bloco chapado**; o `semInset()` remove só as camadas inset.
- **PNG no layout de vidro** só sai certo porque o fundo é uniforme: o exportador compõe o alfa nó a nó (`effOf`). Voltar o degradê quebra o PNG.
- **Regra 4 da seção 2:** o painel migrado tem de ter os três exportadores que o antigo tinha.

---

## 12. Fontes de dados: Google Sheets

### 12.1 Workbooks (apelidos usados nos painéis e nos scripts)

| Apelido | ID | Abas usadas | Quem lê |
|---|---|---|---|
| **DRE** (Visão Financeira) | `1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8` | `Frota` (orc=0, rem=1, real=2, kmRem=5, kmReal=6, vig=9, uni=10, nv3=11, cta=12), `EBITDA`, `Receita Líquida` | visao-financeira (×3), ytg, forecast, painel-km, rs-por-km, arvore-frota, arvore-combustivel, seara/arvore, carta-custos, painel-metas, scorecard, resumo-executivo, fca-preenchimento |
| **Dispersão** (Base Dispersão de km) | `1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM` | `Dispersão de km` (10 painéis; `Km Rem. TT`=AF, `Km Rodado TT`=AG, viagens W/Z/AC/AM), `Balanço de Massa` (Unidade · Vigência · Valor) | painel-km, rs-por-km, eficiencia-ativacao, arvore-frota, arvore-combustivel, painel-metas, scorecard, resumo-executivo, fca-preenchimento |
| **Consumo** | `1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A` | `Km/L`, `R$/L`, `Base Remunerado Modelo`, `De-Para`, `Base CO²` | eficiencia-kml, preco-litro, co2, consumo-kml-analise, arvore-combustivel, scorecard, resumo-executivo, fca-preenchimento |
| **Termômetro** (DPO/Demarco/FCA Total/Metas) | `1oW3mss0pXVI6gaDU2z5cDAKvW40LWHCQXpanqSvb12o` | `DPO`, `Demarco`, `FCA Total` (gid `216663799`, **morta desde dez/25**: o FCA está no banco), `Metas` (gid `199351909`, estrutura do painel-metas) | auditorias, painel-metas, scorecard, diagnostico, resumo-executivo, fca-gerencial (fallback), disponibilidade-migracao |
| **RPM** (Gerot) | `1xGl1Xrk2sPS9zWghEuecFMNBHwmeLiZ02U-QpO8cDPY` | `Base RPM` (= gid 0; sem apuração de jul/26 em diante), `De-Para`, `Consolidado ICs` (**ninguém lê mais**) | scorecard/diagnostico/resumo-executivo (só fallback), fca-preenchimento |
| **Termômetro-tiers** | `10LRn3jrXEemqFiFAMbO8_bOLk98xrWTVXVUNDeQqLac` | `Transportes T1/T2`, `WH T1/T2` (+ `- Acum`), `Regras` | termometro, mpr, gerot-base (OS Vencida, Blitz) |
| **Seara** | `1Rlwc0MZiupQI38gSN8VyBq_zMADgX9R_ZbfygNP-OXE` | `Base Remunerado` (gid 0; col O `ReaisPorKm`), `Base CTEs` (gid `1672208132`; `select B,C,D,J`, **dedup por viagem**), `Combustível` (gid `1982300845`; E placa, F mês, G ano, H modelo, J tipo, K km) | seara-km, seara/*, arvore-frota, rs-por-km |
| **Frota de Elite** | `1DXmjzj2KRrTdQxmvXRclGxhBeDMwoIoLvORqbh3GG6M` | `Pneus` (colada pelo Renan do drill do Ginfo; o ano inteiro de uma vez) | gerot-base (`loadPneusSheet`), painel-metas-validate |
| **Manutenção** | `1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k` | gid 0 (NF a NF) | manutencao |
| **Tendência** | `1EFmp2qlevQG5OEgGJePrI_O8wKuQo3IDmbJIReN2Fl0` | `Base` | tendencia-frota, comparativo-km/-equipamento/-optas |
| **Metas Diretor** | `1lZixK13JKO4zKUJZ5CwdqcPyPLKQDVGxa1o2v1t_tN8` | gid 0 (regras) + um gid por indicador (5) | painel-metas-diretor |
| **Farol Semanal** | `1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY` | `Custos` (única sem robô; colada do DRE) + 6 abas de reserva do Ginfo | farol-core (fallback) |
| Consolidado Geral (Disponibilidade) | `DISP_SHEET_ID` | `Disponibilidade`, `Indisponibilidade`, `Ativos` | disponibilidade (painel antigo), disp-migracao |

### 12.2 Como ler (no navegador)

```js
// fetch + JSON (casca nova)
const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
const raw=await (await fetch(url)).text();
const json=JSON.parse(raw.replace(/^[\s\S]*?\(/,'').replace(/\);?\s*$/,''));
header=json.table.cols.map(c=>c&&c.label?c.label:'');  rows=json.table.rows.map(r=>r.c.map(c=>c&&c.v!=null?c.v:null));
// JSONP (casca antiga): script com tqx=out:json;responseHandler:<fn>  — o gviz-cache cobre os dois
```

Mapear colunas **pelo rótulo do cabeçalho** (`ebIdx(header,'orçado','orcado')`), com fallback de índice; a aba pode ganhar coluna. Quando o cabeçalho não vem nos `cols`, a 1ª linha é o cabeçalho.

**Armadilhas conhecidas (todas reais):**

- **Filtro aplicado na aba esconde dado**: o gviz devolve só as linhas visíveis, sem erro. Sintoma: cards zerados. Conferir antes de caçar bug (workflow **KmL Aba Inspect**). O robô das bases tipadas recusa carga que encolha mais de 40 %.
- `gviz` **trunca abas grandes**; a Base RPM é lida por `/export?format=csv&gid=0`.
- A aba `R$/L` do workbook Dispersão era cópia velha e **foi excluída**; o preço remunerado vem da `R$/L` do Consumo (`KML_ID`).
- A coluna Z (`KM Rodado`) da Base CTEs da Seara **não existe mais**; o km vem da J por viagem.
- **Cache de sessão em `JSON.stringify`** transforma `Date` em ISO (ver seção 9).

### 12.3 Snapshot do gviz (`gviz_snapshot`)

Robô **Gviz Robot** (`scripts/gviz-robot.mjs`, cron de hora em hora `7 * * * *`, e também chamado pelo botão do hub) baixa a lista `ALVOS` (~30 abas: DRE Frota/EBITDA, Dispersão de km, Balanço de Massa, Km/L, R$/L, DPO/Demarco/FCA Total/Metas, Base RPM/De-Para/Consolidado ICs, tiers do Termômetro ×8, Seara ×3, Pneus do Elite, Manutenção, Base da Tendência) e faz upsert do **texto cru** da resposta. Só regrava quando o **md5 mudou** (coluna `hash`), senão só `PATCH updated_at`. **522 em massa = projeto Supabase fora do ar.** O cron do GitHub em repositório público atrasa muito (medido: intervalos de 2h34 a 4h19), por isso o cache aceita 12 h.

### 12.4 Bases tipadas `sh_*` (Sheets → Postgres com colunas)

- **Lista canônica:** `scripts/sheets-bases.mjs` (26 slugs + apelidos): `dre_frota dre_ebitda dispersao_km balanco_massa consumo_km_litro consumo_rs_litro dpo demarco fca_total metas rpm_depara rpm_base rpm_ics seara_remunerado seara_ctes seara_combustivel elite_pneus manutencao tendencia_base mtdir_regras mtdir_ind1_getrans mtdir_ind2_ebitda mtdir_ind3_sucessores mtdir_ind4_ssmaq mtdir_ind5_perdas farol_custos` + as 8 do termômetro por tier. Tabela = `sh_<slug>`; controle em `sh_base` (slug, nome, linhas, carregado_em, erro).
- **DDL gerado** (`scripts/sheets-ddl.mjs` → `scripts/bases-manuais.sql`, 34 tabelas, 572 colunas, 27 índices de vigência), reexecutável (`add column if not exists`). Tipos vêm do que o Sheets declara; `datetime` é `timestamp` **sem fuso**; a vírgula vem antes do `--`; vigência: busca exata antes da parcial.
- **Sheets Robot** (`scripts/sheets-robot.mjs`, `25 * * * *`): grava só quando o md5 da aba mudou; upsert por `linha` e apaga o excedente (a tabela nunca fica vazia no meio); recusa carga que encolha >40 % (`sh_base.erro`).
- **Sheets Check** (`10 11 * * *`): planilha × `sh_base` × tabela.
- **Botão "Atualizar agora"** no hub (card Bases do Sheets, admin): grava um pedido em `sh_pedido` → gatilho `pg_net` chama o `workflow_dispatch` (`scripts/pedido-instantaneo.sql`; token em `portal_segredo`, RLS sem policy) → **Sheets Pedido** roda `sheets-robot` **e depois `gviz-robot`** (as duas bases têm de andar juntas) e devolve o rodapé do log na linha do pedido (poll de 10 s). Varredura `*/5` como rede. `concurrency: sheets-carga` entre os dois workflows de carga.
- **Passo 4 (painéis lendo do banco):** só o **Eficiência Km/L** lê `sh_consumo_km_litro` (com queda para a planilha; selo `Dados de … · banco`). Adaptador devolve `{cols, rows}` com os rótulos da aba, então `detectCols` não sabe a diferença. Conferência obrigatória antes de cada troca: comparador linha a linha (**KmL Banco Check**: 4.165 linhas, 11.077.805 km, 4.403.947 L, 2,52 km/L iguais). **Anon recebe `[]`, não 401** com RLS `to authenticated` → tabela vazia é tratada como falha.

---

## 13. Fontes de dados: Supabase

Projeto `lozwipoeacpvplgkrxkq`. Cliente no navegador: `supabase.createClient(SUPABASE_URL, SUPABASE_KEY)` com a chave publishable. Leituras pelo PostgREST devolvem **no máximo 1000 linhas por pedido**: paginar com `.range()`/`offset`. `Prefer: count=exact` traz o total no `Content-Range`.

### 13.1 Tabelas (arquivo SQL → objetos)

| Domínio | Tabelas / views / funções | Arquivo | Leitura / escrita |
|---|---|---|---|
| Auth e perfis | `fca_profiles` (user_id, unidade = lista `CBA T1,MCC T1`, is_admin, recebe_farol…), `user_approvals` (status), `access_log`, `portal_flags` (`frota_elite_visivel`, `mensagem`), `portal_segredo` | `fca-supabase.sql`, `acessos-supabase.sql`, `portal-flags.sql`, `pedido-instantaneo.sql` | perfis: próprio + admin; approvals: hub; access_log: insert por logado, leitura admin; flags: leitura aberta, escrita admin; segredo: só service_role |
| Funções de acesso | `fca_is_admin()`, `fca_my_unit()`, `fca_has_unit(unidade)`, `delete_user_by_id` (rpc) | `fca-supabase.sql`, `split-cba-mcc.sql`, `carta-custos-rls.sql` | |
| FCA | `fca` (vigencia `mmm/aa`, unidade, projeto, origem Custos/RPM, fato, fato_desvio multi-linha, causa, acao, resp, prazo, status, created_at; trigger `fca_touch`) | `fca-supabase.sql` | select logados; insert/update/delete por `fca_has_unit()` ou admin |
| Planner | `planner` (assunto, acao, resp, prazo, status, obs…) | (sem SQL no repositório) | admin |
| Carta de Custos | `carta_custos`, `contratos_placa`, `erp_abastecimentos`, views `custo_vigencia`, `km_vigencia`, `contrato_mes_atual`, mv `custo_vigencia_mv`, `refresh_custo_vigencia()` | `carta-custos-rls.sql`, `erp-abastecimentos.sql`, `contratos-carta-custos.sql` | 4 policies por `fca_has_unit()`; só a mv tem `grant select to authenticated` |
| Locação | `locacao_benner`, `locacao_modelos`, `locacao_obs`, `locacao_conferencia` | `locacao-*.sql` | select logados; escrita admin |
| Snapshots | `gviz_snapshot` (key, body, hash, updated_at), `ginfo_snapshot` (chave, data jsonb, updated_at), `elite_snapshot` (PK indicador+vigencia+escopo `mes`/`ano`) | `gviz-snapshot.sql`, `ginfo-supabase.sql`, `elite-supabase.sql` | leitura aberta (gviz) / logados; escrita só service_role |
| Bases tipadas | `sh_base`, `sh_pedido`, `sh_<slug>` ×26+8 | `bases-manuais.sql`, `bases-pedido.sql` | select `to authenticated`; escrita service_role; `sh_pedido` insert por admin |
| Disponibilidade | `indisponibilidade` (eventos vivos; trigger `indisp_touch`), `indisp_snapshot`, `disp_snapshot` (append-only, `fonte` sheet/app), `disp_checkins` (insert only), `unidade_depara`, `ativos_manual` (ANG), views `disp_resumo`, `disp_dias`, `hodometro_atual`; funções `disp_unit_cod`, `disp_snapshot_diario()` (pg_cron 09h BRT), `disp_refoto_hoje` (rpc) | `disponibilidade-supabase.sql`, `ativos-manual.sql`, `disp-*.sql` | escrita por `fca_has_unit()`/admin |
| Preventivas Seara | `preventiva_lanc`, `hodometro_leitura` (+ anexos) | `preventivas-supabase.sql`, `preventivas-anexo.sql` | por unidade |
| Forecast | `forecast_scenarios` | `forecast-supabase.sql` | |
| MPR | `mpr_fields` | `mpr-supabase.sql` | |
| Footprint | `footprint_check` (PK placa+chave; status OK/NOK/NA) | `footprint-goiania.sql` | leitura logados; escrita admin; escolher "—" apaga a linha |
| Condução Econômica / DriverPro | `ce_motoristas` (chave `gt:<id>`, cpf), `ce_diario`, `ce_scores_mensais` (competencia, pontuacao, km, litros, km_litros, placa, podio…), `ce_app_acesso`, `ce_app_sessao`, `ce_app_admins`, `ce_app_regras` (pesos, saldo, top, km_min, unidades[]), `ce_app_unidade_cfg` (unidade, grupo, top_n, km_min, qlp), `ce_app_log`; funções `ce_app_login`, `ce_app_criar_pin`, `ce_app_dados`, `ce_app_ping`, `ce_app_sair`, `ce_app_cadastro(_lista)`, `ce_app_motoristas`, `ce_app_unidades`, `ce_app_unidade_set`, `ce_app_unidade_cfg_set`, `ce_app_criterios` (anon), `ce_app_km_min`, `ce_app_top_n`, `ce_app_grupo`, `ce_app_unidade_ativa` | `conducao-economica.sql`, `app-motorista.sql` | app fala só por RPC (`security definer`) |
| Pneus (Prolog) | `snapshot`, `historico_mensal` (projeto antigo unificado no principal) | `pneus-unifica-*` | |

### 13.2 Regras de RLS que já quebraram

- `fca_has_unit(unidade)` compara **cada** unidade do perfil; `= fca_my_unit()` compara com a string inteira e falha para quem tem duas unidades (7 perfis afetados na Carta em 24/08/2026). Auditoria: **Carta RLS Check**.
- RLS `to authenticated` + sessão anon = **lista vazia**, não erro. Tratar vazio como falha quando o painel pode ser aberto deslogado.
- `fca_profiles` não tem coluna `id` (é `user_id`); `order=id` dá 400.
- O hub grava `sessionStorage gem_hub=1` para liberar os painéis na sessão; gestor com unidade e sem admin é **roteado direto** para `fca-preenchimento/` (`maybeRouteByRole`).

---

## 14. Fontes de dados: APIs e robôs

| Fonte | Como | Robô / script | Destino | Regra de período |
|---|---|---|---|---|
| **Ginfo (Power BI homologado da Ambev)** `bi.ginfo.app.br/bi/inicio` | Playwright: login (Empresa CONLOG + e-mail + senha), menu lateral (SPA; deep-link morreu em 20/08), relatório abre em aba com `reportId`, "…" → Exportar dados → xlsx. Abas anteriores ficam vivas no DOM: buscar só no iframe do `reportId`. Rodapé "Filtros aplicados" do export é descartado. | `ginfo-robot.mjs` (modos login/mapa/tabelas/run; cron `0 10 * * *`) | `ginfo_snapshot` chaves `ativos · stress-test-frota · stress-test-empilhadeira · civf · preventivas · alinhamentos · os-em-aberto · checklist-031120 · blitz-seguranca` | dia 01–10 = mês anterior; Checklist até o 3º dia útil; Blitz: slicers ANTES do drill (`slicersAntes:true`) |
| **Frota de Elite (mesmo Ginfo, por vigência)** | Playwright; 11 indicadores × mês + acumulado do ano; três mecânicas de filtro (`dropdown`, `datas`, `botoes`); período que não aplica **aborta** sem gravar; pula chave já gravada (`refazer` para sobrescrever) | `elite-robot.mjs` (modos login/mes/backfill/conf-drill/conf-detalhe; cron `30 10 * * *`, age do dia 01 ao 15); **Conf Detalhe** (`0 11 * * *`, cobrança por placa) | `elite_snapshot` (`disponibilidade, preventivas, pneus, checklist-t1/t2/wh, conformidade, conformidade-detalhe, conformidade-dia, stress-test-frota/-empilhadeira, civf, sla-manutencao`) | mês anterior fechado |
| **Conta do Ginfo é UMA** | os três workflows (`ginfo-robot`, `elite-robot`, `conf-detalhe`) compartilham `concurrency: group: ginfo-conta` (10/09/2026): os crons de 10:00/10:30/11:00 UTC se alcançavam | | | |
| **Nunca deep-link, sempre MENU** | desde 20/08 o `/bi/<guid>?autoAuth=…` recarrega o app Vue numa casca sem relatório e o Power BI rende com `slicers visíveis: []`; o Farol foi corrigido em 27/08 e o Elite em 10/09 (PR #1128). Todo relatório abre em `/bi/inicio` e navega pelo menu | | | |
| **Prolog (pneus)** | API; branch_id → código do Farol | `pneus-loader.mjs` (`0 9,21 * * *`), `profrotas-robot.mjs` (`30 9 * * *`, hodômetro) | `snapshot`, `historico_mensal`, `hodometro_leitura` | |
| **Geotab MyGeotab** (`database ambev`) | JSON-RPC `/apiv1`: `Trip` (km, idle, faixas de velocidade), `ExceptionEvent` (aceleração/freada), `FuelUsed` (litros); CPF do motorista = campo `name` | `conducao-robot.mjs` (modos sonda/run/recalc/reproc/ident/litros/cpf/carteira/programa/…; cron `20 10 * * *`) | `ce_diario`, `ce_scores_mensais`, `ce_motoristas.cpf` | dia anterior; `CE_DE/CE_ATE` |
| **vFleets DaaS** | `GET /integrationcore-conducao/conducoes/detalhada?dia=`; **1 req/5 min** (pausa 305 s); `kmCalculado=true` obrigatório; km em metros; `/processamentos` lista dias reprocessados | idem | idem | |
| **ERP (abastecimentos)** | query passada pela TI (`scripts/erp-abastecimentos-query.sql`) | `abastecimentos-robot.mjs` (`15 11 * * *`) | `erp_abastecimentos` → `custo_vigencia_mv` | |
| **Contratos (planilha)** | | `contratos-robot.mjs` (`0 11 * * *`) | `contratos_placa` | |
| **Qlik Sense (DRE)** | **parqueado**: `bi.conlogsa.com.br` não é alcançável de fora | `qlik-robot.mjs` | | |
| **Resend** | e-mail (SMTP do Supabase Auth; avisos de falha; Farol semanal `farol-mailer.mjs` `0 17 * * 1`) | `avisa-falha.sh` | | **`vars.MAIL_TO` está vazia**: nenhum aviso de falha chega |

Pesos do DriverPro: `PESOS = {rpm:50, idle:30, acel:20}` (base 100, 07/09/2026), régua `REGUA` (rpm direto; idle zera em 25 %; acel zera em 3/100 km). Os pesos moram em **quatro lugares** que têm de bater: `conducao-robot.mjs`, `ce_app_regras.peso_*`, `PILAR[*].peso` no painel e a demo do app; mudou → rodar `recalc`.

---

## 15. Autenticação, perfis e acessos

- **Supabase Auth** no hub: `signInWithPassword`, `signUp` (confirmação por e-mail via Resend), `resetPasswordForEmail`, `updateUser({password})` no evento `PASSWORD_RECOVERY`, `signOut`. Site URL configurada para o Pages. Erros traduzidos por `traduzirErro(msg)`.
- **Aprovação:** usuário novo cai em "pendente" (`user_approvals.status`); admin aprova/bloqueia/remove em Gerenciar Acessos; `bi_approved_<uid>` em localStorage evita a consulta a cada abertura; `checkApproval` reconfere no banco.
- **Perfil (`fca_profiles`):** `unidade` como lista separada por vírgula; `is_admin`; flags de Farol. Unidades com tier: `CBA T1` (Empurrada) · `CBA T1 WH` (Apoio/Empilhadeiras) · `CBA T2` (CDD) · `MCC T1` · `MCC T2`; 14 unidades ao todo (ANG, BLC, CBA T1, CBA T1 WH, CBA T2, CGR, FLP, GRL, MCC T1, MCC T2, NFR, PIR, PLT, RON).
- **Roteamento:** gestor com unidade e sem admin vai direto ao FCA da unidade (`maybeRouteByRole`, `sessionStorage gem_routed`). `sessionStorage gem_hub=1` libera os painéis na sessão.
- **Log de acesso:** `logAcesso(painel, user)` → `access_log` (hub, fca-preenchimento…); painel `/acessos/` (admin) lê.
- **Painéis abertos sem login** continuam funcionando com Sheets; os que leem tabelas `to authenticated` mostram aviso ou caem na planilha. O FCA da unidade **não tem mais pré-visualização silenciosa**: sem sessão, sem perfil ou perfil sem unidade, a tela diz o que falta (`telaAviso`); `?preview=1` continua sendo a demo explícita.
- **Cortina do Frota de Elite:** `portal_flags.frota_elite_visivel` esconde o resultado para não-admin (último estado em `bi_elite_cortina`).

---

## 16. Workflows do GitHub Actions (71)

**Agendados (o que roda sozinho):**

| Workflow | Cron (UTC) | Script | Grupo |
|---|---|---|---|
| Ginfo Robot | `0 10 * * *` (7h BRT) | `ginfo-robot.mjs` run (8 abas) | `ginfo-conta` |
| Elite Robot | `30 10 * * *` (age dia 01–15) | `elite-robot.mjs` mes | `ginfo-conta` |
| Conf Detalhe | `0 11 * * *` | `elite-robot.mjs` conf-detalhe | `ginfo-conta` |
| Gviz Robot | `7 * * * *` | `gviz-robot.mjs` | |
| Sheets Robot | `25 * * * *` | `sheets-robot.mjs` | `sheets-carga` |
| Sheets Pedido | `*/5 * * * *` + dispatch pelo gatilho | `sheets-pedido.mjs` | `sheets-carga` |
| Sheets Check | `10 11 * * *` | `sheets-check.mjs` | |
| Conducao Robot | `20 10 * * *` | `conducao-robot.mjs` | |
| Abastecimentos Robot | `15 11 * * *` | `abastecimentos-robot.mjs` | |
| Contratos Robot | `0 11 * * *` | `contratos-robot.mjs` | |
| Pneus Loader | `0 9,21 * * *` | `pneus-loader.mjs` | |
| Profrotas Robot | `30 9 * * *` | `profrotas-robot.mjs` | |
| Farol Frota (e-mail) | `0 17 * * 1` | `farol-mailer.mjs` | |
| CE Coletor (python) | **desagendado** (duplicava o Conducao Robot) | `etl/conducao-economica/coletor.py` | |

**Sob demanda (auditorias e conferências, todos só leitura):** Fechamento Check (o que falta no mês) · Metas Aba Inspect · FCA Unidade Inspect · FCA Gantt Inspect · KmL Banco Check · KmL Aba Inspect · Arvore Comb/Frota/Inspect · Balanco Massa Check · Carta RLS Check · Conf Detalhe Check · Contrato Agora Inspect · Contratos Man Inspect · Disp Buracos/CBA Inspect · Disp Migracao · DRE Vig Inspect · DriverPro Check · Elite Cols/Vigencias Inspect · Footprint Check · Gerot Elite Build/Inspect · KM Jun/PIR · KM Merge · KM R$/km Pacotes · KML Comb/Impacto/Rem Abril/Rem Modelo · Locacao Modelos Backfill · Macacu Fusao Check · Metas Diretor Inspect · OS Critica Inspect · Painel de Metas Inspect · Perfil Inspect · Peso Boot · Planner Nomes Check · Pneus Aba/Desgaste/Medidas/Unifica Inspect · Pneus Unifica Migra · RPM Inspect · Scorecard ICs Check · Scorecard RPM Validate · Seara Abas/KM por Viagem/R$/km Decomp/R$/km Inspect · Sheets DDL · Sheets Inventario · Termometro Inspect · Conformidade Termometro · Qlik Robot · Ramos Fornecedor.

**Regras dos workflows:**

- Um workflow novo só aceita `workflow_dispatch` depois de estar no `main`.
- O `schedule` do GitHub em repositório público **atrasa horas**; nada pode depender do minuto do cron.
- Sucesso parcial fecha o job em **vermelho** (Conf Detalhe grava tudo e falha por 2 filiais); ler o log, não o status.
- O endpoint de jobs do GitHub **atrasa**: job "in_progress" pode já ter terminado.
- Robôs do Ginfo tentam 3× e abortam **sem gravar** quando o período não aplica.
- Logs sem nome de pessoa, CPF, token.
- `avisa-falha.sh` imprime `::error::` quando a Resend recusa; sem `MAIL_TO` o alarme não toca.
- Fila do Actions em horário de pico pode cancelar sem log (`runner_id: 0`): redisparar.

---

## 17. Módulos com regra própria

### 17.1 FCA (`fca-preenchimento/` unidade · `fca-consolidado/` admin · `fca-gerencial/` aderência)

- Visões (`TIT`): `kanban` Kanban (padrão de abertura) · `tabela` Fatos · `flat` Tabela · `gantt` Gantt · `resumo` Resumo (Aderência compartilhada). Lateral `.s-item[data-v]` + `vaiPara(v)`.
- Kanban: `.kanban > .kcol (.kcol-head.nao/.and/.con) > .kcard (.kcard-top, -fato, -desvio, -causa, -ac, -meta .atraso)`; badge `.kbadge.ok/.venc/.sem`. FCAs automáticos (sem ação) no topo; depois por vencimento. Status: `['Não iniciada','Em andamento','Concluída','Cancelada']`.
- Geração (manual, admin): `gerarFatos` / `gerarTodas` (**Custos**: pacote líquido que estourou vs remunerado, contas dentro do fato como `▲ estouro / ▼ saving`, causa vazia; Estorno de ICMS e ICMS Crédito Presumido vão para `ICMS`, não Combustíveis) e `desviosDoGerot` (**RPM**: todo indicador do `elite_snapshot` com `atgMeta < 100 %`, na última vigência com dados, `fato_desvio = Meta | Real | Ating`; combustível **não** gera). `sincronizarRPM` é o caminho antigo pela Base RPM. Aditivo pela chave vig+RPM+projeto+fato.
- `fato_desvio` tem várias linhas (`\n`); telas renderizam `\n`→`<br>`. Filtro Indicador/Conta lista as contas dentro dos fatos.
- Unidades e RPM por tier (`RPM_UNIT_MAP`); `(INATIVO)` mesclado.

### 17.2 Planner Corporativo (`planner-corporativo/`, admin)

Tabela `planner` (assunto, acao, resp, prazo, status, obs). Etapas `ETAPAS = Backlog → Não iniciada ("Planejando") → Em andamento ("Em execução") → Concluída ("Concluído")` + `Cancelada`. Visões Kanban (abre) · Tabela · Gantt · Aderência (por Assunto/Pessoa). Cópia de teste em localStorage (`planner-teste*`).

### 17.3 Gerot / Frota de Elite / Scorecard

- **Fonte:** `elite_snapshot` via `gerot-base.js`; a planilha Frota de Elite ficou só para `Pneus`. Combustível vem do Km/L (gviz).
- **Indicadores-chave** (`INDICADORES`): disp · prev · comb (km/L) · pneus · checkT · checkWH · conf · stVeic · stEmp · civf · sla. **Metas** (`METAS`): disp 95 · prev 100 · pneus 100 · checkT/checkWH 95 · conf 100 · stVeic/stEmp 100 · civf 100 · sla 75. `atg` = a própria aderência (é o que o Frota de Elite pontua); `atgMeta = real ÷ meta` (cap 100; é o que o Gerot mostra e o que gera FCA).
- **Adicionais só do Gerot** (`INDICADORES_GEROT`, `soGerot:true`): Amplitude (`pneuAmp`, meta 5 mm) · MTBF/MTTR (meta = 3º quartil) · OS Vencida (`osVenc`, meta <10) · Saída com OS Crítica (`osCritica`, meta 0, binário) · Blitz de Segurança (meta 100) · % Calibragem OK (`pneuCalib`, ≥98).
- **Acumulado do ano é obrigatório** e vem do escopo `ano` por vigência (média de médias ≠ ponderado); só stress/civf/pneus poolam sozinhos (`POOL_FIELDS`).
- **Conformidade:** corte em `CONF_CORTE='2026-08'` (régua nova = contagens por prazo; antiga = Mensal/Bimestral); empurradas só contam de `CONF_EMP_INI='2026-04'`; regra é da **filial**, não da unidade unida.
- **Fusão MACACU** (`load({fundir:true})`, só no programa-reconhecimento): cada indicador combinado pela própria régua; combustível por **pool de litros** (`combFunde`), nunca Σkm÷Σlitros.
- **Isenções** do Stress Test de empilhadeira: `ST_EMP_ISENTOS` por identificador e vigência.
- **`r.unit` é o NOME da unidade**, nunca o código; passar por `COD2UNIT` de novo devolve `undefined`.
- Painéis de IC são **três** (scorecard, diagnostico, resumo-executivo); conferência **Scorecard ICs Check**.

### 17.4 Farol / Gestão à Vista (`farol-core.js`)

Lê `ginfo_snapshot` e converte com `GADAPT` (Preventivas: Aderência = Vencido→0; Projeto por join com `ativos`; CIFV: Desconto Total≠0→0; Stress Test: desconto 0→1; OS: dias em aberto = hoje−Data). Sem base → cai na aba do Sheets. Cada seção mostra a "última exportação do Ginfo" (`DATA.ginfoAtt`). Topo diz **"Tela carregada"**, não idade do dado. Chip Saída OS Crítica binário. Blitz ordenada por dias para vencer. Visão **Contrato** = km do mês corrente → fatura do mês seguinte (`custo_vigencia_mv`), variável e fixo separados, sempre visível com a mensagem do erro quando falha.

### 17.5 Disponibilidade (`disponibilidade-preenchimento/`)

Eventos vivos em `indisponibilidade` (abre ao parar, `data_retorno` ao voltar); foto diária `disp_snapshot_diario()` (Ginfo `ativos` + `ativos_manual` da ANG × indisponíveis); histórico migrado do Sheets (`fonte='sheet'`). Sem Kanban, sem check-in manual, retorno por campo de data, FRETEIRO fora. Resumo = view `disp_resumo`. O painel antigo `/disponibilidade/` ainda lê o Sheets (a aposentar).

### 17.6 DriverPro (`app-motorista-4/`)

PWA (`manifest.json`, `sw.js` `driverpro-v18`, Inter, tokens próprios `--bg:#0F1A20 --acc:#F22C05`; tema claro por classe). Fala com o banco **só por RPC** (`ce_app_login`, `ce_app_dados`, `ce_app_ping`…). Regras: unidades no programa (`ce_app_regras.unidades`, hoje só `EMP PIRAI`); critérios por unidade e **grupo** (`ce_app_unidade_cfg`: Empurrada top 15/1.000 km, Lata top 5/500 km, um ranking por grupo PIRAI); **ranking entre quem disputa** (`pos` só para `disputa`; `posicao_geral` vai junto); número grande = **carteira + pódio**, barra = só carteira, linha "Prêmio do pódio" no card; pilares *Uso da faixa verde (até 1.700 RPM)* · *Motor ligado sem rodar* · *Acelerações bruscas*; freada não pontua. Domínio `driverpro.onespot.com.br` pelo repositório `fortesindicadores-byte/driverpro` (sync a cada 15 min, com CNAME). Log de uso em `ce_app_log`; painel Condução Econômica tem visões Acessos e Ranking de Acessos, Carteira em R$, Km/L Gerencial e Ranking Km/L (litros do `FuelUsed`; km/L = Σkm ÷ Σlitros **só das viagens com litros**, descartando >12 km/L).

### 17.7 Carta de Custos / Contrato de Manutenção

`carta_custos` por pacote; RLS multi-unidade; contrato por km em `contratos_placa` + `erp_abastecimentos` → `custo_vigencia_mv` (`vig_cobranca = vig_km + 1`). Robôs Contratos (planilha) e Abastecimentos (ERP). Fixo e variável nunca somados.

### 17.8 Seara (workbook único, 3 abas)

KM realizado da `Combustível`; KM remunerado da `Base CTEs` col J **contado uma vez por `CD_VIAGEM_TRANSPORTE`** (sem dedup infla 23×); R$/km da `Base Remunerado` col O (variável; N tem fixo, T é só diesel). Placa canonizada para Mercosul só para cruzar. Mês sem CTE usa o anterior por placa (aviso no card). Layout largo restaurado em 14/08 (`KmPorLitro`, `PrecoDiesel` como benchmark). **Km/L remunerado = `KmPorLitro` (col P) ponderado pelo km rodado da `Combustível`** (`Σkm ÷ Σ(km ÷ KmPorLitro)`), nunca por viagens da Base CTEs, que chega dois meses depois e zerava o mês (11/09/2026). O Km/L · Seara lê só `Combustível` + `Base Remunerado`; conferência: **Seara KmL Peso Check**.

### 17.9 Combustível

Árvore monta tudo das fontes (Frota do DRE, Dispersão, Km/L e R$/L do Consumo); aba `Árvore Comb.` não é lida. **Balanço de Massa** recompõe km remunerado das empurradas (coluna **`Valor 85%`** ÷ R$/km remunerado dos 3 pacotes ÷ km original; rateado proporcional — desde 10/09/2026 é a D, não mais a `Valor` crua) só no Painel KM e na Árvore. Eficiência Km/L lê do banco (12.4). VAN não tem preço remunerado.

### 17.10 Painel de Metas

Cinco indicadores calculados das origens (Custos ← AV Orçado/Real do DRE do mês; Ranking ← Frota de Elite; Dispersão ← Dispersão de km acumulada; DPO ← aba DPO; Consolidação de FCAs ← **tabela `fca`** desde 10/09/2026, com a aba morta como reserva). A aba `Metas` dá só a estrutura (indicador, peso, meta, descrição, regra); **a estrutura do último mês se repete até o último mês fechado** (`herdaMeses`), com o rodapé dizendo quais meses estão herdados. Pesos 25/20/20/20/15; metas 85 / 5 / 100 / 75 fixas; a de Custos é do mês.

---

## 18. Publicação: build, cache, PR e branch

1. **Editar** o painel; validar sintaxe dos `<script>` inline sem navegador (`node -e "new Function(code)"` bloco a bloco) e `node --check` nos `.mjs`.
2. **Bump** `<meta name="build" content="AAAAMMDDHHMM">` e `build-check.js?v=AAAAMMDDHHMM` (iguais).
3. **Commit** com mensagem em português explicando o porquê; termina com:
   ```
   Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01CoPzrx19nUHZqody5fEJUg
   ```
4. **Push** `git push -u origin <branch>`; **PR** (não rascunho) com corpo terminando em `🤖 Generated with [Claude Code](https://claude.com/claude-code)` + a URL da sessão; **squash merge** no `main`; avisar no chat que publicou.
5. **Realinhar** a branch de trabalho: `git fetch -q origin main && git checkout -qB <branch> origin/main && git push -q --force-with-lease -u origin <branch>`.
6. O usuário recarrega com **Ctrl+Shift+R** se a aba já estava aberta; o `sw.js` (só navegação, sem storage) e o `build-check` cuidam do resto.

Git: usar caminhos absolutos ou `git -C /home/user/gestao-em-movimento`. O sandbox **não alcança** Supabase, docs.google, github.io nem CDNs: toda conferência de dado roda pelo Actions.

---

## 19. Chaves de localStorage e sessionStorage (medidas no repositório)

| Chave | Uso |
|---|---|
| `bi_theme` (120) | tema `light`/`dark`, hub e casca antiga e painéis novos |
| `bi_user_name` · `bi_last_user` · `bi_last_access` (50 cada) | "último acesso" da casca antiga |
| `gem_hub` (42, session) | sessão liberada pelo hub |
| `gem_routed` (session) | gestor já roteado ao FCA |
| `gem_hub_clu` | cluster aberto no hub · `gem_hub_modo` / `gem_hub_abertos` (hub anterior) · `gem_adm_mini` |
| `bi_approved_<uid>` | aprovação em cache |
| `gem_sw_reload` · `gem_reload_<path>` (session) | guardas do build-check |
| `<painel>_mini` (`vfa_mini`, `vfc_mini`, `km_mini`, `kmseara_mini`, `sc_mini`, `fca_mini`, `planner_mini`, `gav_mini`, `cc_mini`, `disp_mini`, `ce_mini`, `at_mini`, `acs_mini`, `fpg_mini`, `conf_loc_mini`, `seara_prev_mini`) | lateral recolhida |
| `vfa_tema` · `pneus_theme` · `app4_theme` | temas próprios (exceções) |
| `bi_cache_vf_v8` (TTL 1 h) · `re_*` · `sc_*` · `planner_cache_v1` · `cc_frota_v1` · `cc_vista_lanc` · `fca_prev_*` · `seara_prev_vw` · `disp_unit` | caches e estado por painel |
| `sc_data2` (IndexedDB via SwrCache) | pacote do Scorecard |
| `app4_token` · `app4_chave` · `app4_admin` | sessão do DriverPro |
| `bi_elite_cortina` | último estado da cortina do Frota de Elite |

---

## 20. Pendências conhecidas (10/09/2026)

- **Migração para o banco (passo 4):** só o Eficiência Km/L lê `sh_*`; os demais painéis continuam no gviz. Dentro do Km/L, `R$/L` e `Base Remunerado Modelo` ainda vêm da planilha (a segunda nem tem tabela). Cada troca exige um comparador antes.
- **Migração para a casca padrão:** 42 painéis ainda na casca antiga (inventário, seção 3).
- **Scorecard, Diagnóstico e Resumo Executivo** ainda declaram a aba `FCA Total` (morta) para o FCA; precisam ler a tabela `fca` como o Painel de Metas passou a fazer.
- **Consolidado ICs** e **FCA Total** continuam na lista de bases do Sheets Robot sem leitor; tirar ou manter é decisão do Renan.
- **`vars.MAIL_TO` vazia:** nenhum robô avisa quando falha.
- **Elite Robot de ago/26:** 7 indicadores faltaram em duas rodadas. Causa real (10/09, à noite): eram exatamente os sete que ainda abriam por **deep-link** `/bi/<guid>?autoAuth=…`, morto desde o portal novo de 20/08; os quatro sem deep-link passavam. Corrigido no PR #1128 (todo relatório abre em `/bi/inicio` e navega pelo menu). O grupo `ginfo-conta` continua valendo por outro motivo (o Elite alcançava o Conf Detalhe todo dia). Terceira rodada em curso.
- **FCA de agosto:** só fatos de Custos; Desvios da RPM a gerar (o Renan roda na segunda-feira).
- **Seara Base CTEs / Base Remunerado** param em 06/2026 (fluxo normal de fechamento; chegam depois da Combustível).
- **Geotab:** clearance da conta não libera leitura de dados via API (pedido aberto na Argus); hoje só vFleets alimenta de verdade.
- **Qlik (DRE → Custos):** parqueado por rede.
- **Painel `/disponibilidade/` antigo** e o trigger do Apps Script: desligar só depois de comparar os números por 1–2 semanas.
- **Aderência (quem atualiza a Indisponibilidade)** e detalhamento da visão Resumo com o Renan.
- `hub-classico/`, `visao-financeira-arvore/`, `visao-financeira-cheia/`, `carta-custos-teste/`, `planner-teste*/`, `app-motorista/-3/-5` são variantes guardadas; não são o oficial.
