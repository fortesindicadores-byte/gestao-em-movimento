# Materiais do Freightech — contexto da sessão (até 26/10/2026)

Arquivo de retomada: o que existe, como regerar, o que foi decidido e o que falta. O diário completo (porquês, falas do Renan) está no `CLAUDE.md`, seção "Freightech". Este arquivo é o resumo operacional.

## 1. O que existe hoje

Quatro materiais em PDF, todos revisados em 26/10/2026 de manhã e enviados pelo chat (nunca pelo repositório, porque trazem remuneração da Ambev e placas):

| Material | Arquivo | Slides | Gerador |
|---|---|---|---|
| Análise completa 2026 (jan–ago, T2) | `Analise_Freightech_2026.pdf` | 19 | `deck-analise.mjs` |
| Histórico 2022–2026 × DRE | `Analise_Freightech_Historico_2022-2026.pdf` | 10 | `deck-historico.mjs` |
| Treinamento para gestores | `Treinamento_Remuneracao_Gestores.pdf` | 9 | `deck-treinamento.mjs` |
| Manual de frota (cada custo, memória de cálculo, origem) | `Manual_Freightech_Frota.pdf` | 21 | `deck-manual.mjs` |

Decks anteriores (`deck-2026.mjs`, `deck-oportunidades.mjs`, `deck-unidades.mjs`, `deck.mjs`) são de 24–25/10 e foram superados pelos quatro acima. As oportunidades 1 e 2 deles (fatura VW × FT e manutenção zero) estavam calculadas sobre o campo errado (`R$/KM` em vez de `Manutenção R$/KM`) e não valem.

Código no repositório: `docs/analise-freightech/`. Dados (dump decifrado, parquet, pkl, json, html, pdf) ficam só no scratchpad da sessão e nunca são commitados.

## 2. Pipeline e comandos

Pasta de trabalho dos dados: `$A = <scratchpad>/ana` (hoje `/tmp/claude-0/-home-user-gestao-em-movimento/df61d1fb-06c6-51a4-9fae-692ed62b893f/scratchpad/ana`). Os `.py` e `.mjs` de lá são cópias dos do repositório; o repositório é a fonte.

1. **Dados:** workflow **Analise Dump** (`scripts/analise-dump.mjs`) publica o dump cifrado no branch `tmp-analise-dump`; a chave privada mora só em `scratchpad/ftkey/priv.pem`. Decifrar, rodar `load.py` + `sh.py` (parquet em `$A/pq`), e apagar o branch com `so_apagar=true`.
2. **Análise por período:** `cd $A && INI=2026-01 FIM=2026-08 ROTULO=2026 python3 completa.py` grava `completa-2026.json` e `completa-2026.pkl` (um por ano para o histórico: 2022–2026). O período é cortado no último mês com `Km Rem. TT` na Dispersão (`FIMD`); setembro fica fora porque a aba acaba em ago/26.
3. **Cruzamentos por unidade:** `cd $A && INI=2026-01 FIM=2026-08 ROTULO=2026 python3 extra.py` lê o pkl e grava `extra-2026.json` (`manut_uni`, `manut_contas`, `saldo_uni`, `saldo_mes`, `comb_uni_placa`, `pneu_uni`, `fixo_uni`).
4. **Histórico:** `python3 historico.py` junta os `completa-<ano>.json` em `historico.json`.
5. **Manual:** `python3 manual.py` grava `manual.json` (campos, fórmulas e exemplos lidos das tabelas e das fórmulas exportadas do FT).
6. **Decks** (na pasta `docs/analise-freightech`):
   - `CMP=$A/completa-2026.json OPO=$A/opo.json EXTRA=$A/extra-2026.json FT_HTML=$A/analise26.html node deck-analise.mjs`
   - `HIS=$A/historico.json OPO=$A/opo.json FT_HTML=$A/historico.html node deck-historico.mjs`
   - `OPO=$A/opo.json FT_HTML=$A/treinamento.html node deck-treinamento.mjs`
   - `MAN=$A/manual.json FT_HTML=$A/manual.html node deck-manual.mjs`
7. **Conferência visual antes de mandar:** copiar `$A/vaza.mjs` → `docs/driverpro-apresentacao/_vaza.mjs` e `$A/shots.mjs` → `_shots.mjs`, rodar (prints em `$A/sh_<deck>`), apagar as cópias. O `vaza.mjs` pega texto fora da caixa, mas ignora `.foot`: conclusão encostando no rodapé só aparece na altura (`shots.mjs`; cabe quando o conteúdo fica em até ~620 px).
8. **Render:** `cd docs/driverpro-apresentacao && PW_CHROME=/opt/pw-browsers/chromium node render.mjs <html> <pdf>`; PDFs em `$A/out/`. Enviar pelo `SendUserFile`.

## 3. Regras de cálculo confirmadas nos dados

- **Variável da placa (T2):** `Consumo R$/KM + Manutenção R$/KM + Manutenção Carroceria R$/KM + Pneu por KM` (fecha ao centavo). O `R$/KM` do contrato NÃO entra no pagamento.
- **Manutenção paga pelo `Manutenção R$/KM`** (BID por montadora × capacidade × km, ou a `ManutencaoCavalo`), zero só na carência; o `R$/KM` é o contrato da placa.
- **Fixo:** FINAME + seguro + IPVA + rastreador + faixa reflexiva + lavagem (lavagem fixa por mês na Rota). Caminhão parado recebe fixo de parado (`Total Caminhão Parado`).
- **Km:** km da placa ÷ 25 = km por mapa; × ativos = teto; pago = km por mapa × viagens realizadas (+ recargas e noturnas). O km do FT é o teto, não erro.
- **Diesel:** paga o menor entre o nosso preço e a ANP; em 100% dos registros o pago foi o nosso preço.
- **Resumo do FT é mensal e cada quinzena repete o mês** (mês = média das duas quinzenas).
- **DRE × FT compara-se ao km pago** (componentes do FT × km da Dispersão ÷ km do FT, por unidade × mês), com Rota + Van + UDC + AS juntos.

## 4. Achados que estão nos materiais (2026, jan–ago, T2)

- Déficit R$ 3,4 mi (R$ 190 mil em jan a R$ 815 mil em jun). Rio 43%; Guarulhos + Cuiabá 31%; Nova Friburgo, Macacu, Rondonópolis e Pelotas fecham perto do pago. Frota parada e viagens por ativo não separam quem fecha; o custo por km rodado separa.
- Manutenção: FT paga R$ 3,1 mi; a DRE lança R$ 2,8 mi de contrato do fabricante e R$ 3,0 mi de oficina. No Rio o contrato sozinho passa o pago. Idade não explica (Guarulhos, 78 meses, recebe o maior R$/km; Rondonópolis, 9 meses, gasta R$ 120 mil de oficina).
- Combustível +23% constante nos 8 meses. No Rio 72 das 139 placas rodam 15% ou mais abaixo do Km/L previsto (42% do km, 100 mil L a mais); o tanque interno cobre parte. Em Cuiabá a causa é km, não consumo.
- Histórico: receita +73% de 2022 a 2025 por frota e km, não por preço; variável parado em ~R$ 3,0/km; manutenção paga −32%/km; Km/L rem 2,92 → 3,31; fixo +259% por caminhão; déficit em todos os anos (2024 o melhor, 2026 o pior); Piraí T1 Km/L do trecho 2,37 → 1,99.
- 71 placas ativas com manutenção zerada fora da carência (mais de 24 meses): precisam de validação uma a uma (planilha `placas_xlsx.py`, já enviada).

## 5. Regras de escrita (feedback acumulado do Renan)

- Tom executivo, direto, objetivo. Sem "Ambev", sem "o que questionar", sem "levar à mesa".
- A palavra **"régua" não existe** nos materiais: é "previsto pelo FT".
- Toda conclusão cita **unidade, causa e a contra-prova** (o que NÃO explica). Nunca só o total, nunca repetir o gráfico.
- Apresentação sem textos extensos: tabelas clean e legíveis (texto `INK`, cabeçalho mais escuro), gráficos, bridges; conclusão escrita embaixo de todo slide (`conc()` no `deck-base.mjs`).
- Texto nunca vaza da caixa (`cabe()` no manual; `contaColuna` para somas longas). Rodar o `vaza.mjs` antes de mandar.
- Todo número da conclusão sai do JSON, nunca digitado.
- Manutenção não é só contrato: há placas sem contrato.

## 6. Pendente

- **Confirmar com o Renan** como o pacote do SRTrans é pago por mapa ("cada mapa é uma DRE"): se o mapa não rodado tira também fixo, equipe e indiretos. Até lá, nada afirma que mapa não rodado é ou não é perda.
- **Resto do fixo da carreta** não exportado (linha "Demais (campo não exportado)" no manual).
- Se o Renan aprovar o padrão das conclusões novas, levar o mesmo nível (unidade/causa/contra-prova) aos slides da Análise 2026 ainda não refeitos: pneu, fixo, evolução, Km/L, divergências, T1, receita.
- Puxar os dados da carga "todas 2026" (`todas=1`, já rodada) e as fórmulas (`modo formulas`) → Analise Dump → decifrar → `load.py`/`sh.py` → completar o manual (fixo da carreta, Armazém, AS/Van) → ligar Faturamento à receita da DRE → versão final dos PDFs. Depois, a carga desde 2022. Apagar `tmp-analise-dump` depois de ler.
- Etapas seguintes do pedido original: painel **Remuneração** (Resumo Gerencial, tabela analítica, gráficos, histórico) → IA só para o dono (Edge Function com a chave) → orçamento (planilhas dele + base histórica + previsões + aprendizado dos FCAs) → robô de insights (backlog).

## 6b. Feedback visual pendente (Renan, 26/10/2026) — aplicar em TODOS os materiais de uma vez

Renan, vendo os slides 3 (três contas no Resumo) e 4 (FINAME) do Manual: *"Você considera essa visão clean? Você considera que está bem distribuído? textos com quebra na tabela?"* e *"Aqui também. Não está moderno e clean"* → *"olhe geral nisso. Guarde para ajustar em tudo. Vou mandar mais infos."* **Nada foi alterado ainda; ele vai mandar mais orientações antes.** O que está errado e o que foi proposto:

- **Quebra de linha em célula de tabela é proibida.** No slide 3 quebram o cabeçalho "Relatório (tabela FT)", o campo "Total por Caminhão Frota Parada · Total Caminhão Parado", o "O que é" do R$/km e até o exemplo "R$ 2,91/km × 2.369". Causa: a coluna "Relatório" (que repete "Resumo"/"Caminhão" em toda linha) rouba largura das outras.
- **Coluna "Relatório" sai da tabela de origem**; o nome do relatório vai para o cabeçalho ou para a nota. Tabela fica Campo · O que é · No exemplo, cada célula numa linha.
- **Nome de campo em português**, com o nome técnico do FT (`statusFinanciamentoShared`) só em cinza pequeno ao lado, para quem for ao FT.
- **A fita de memória de cálculo não é fórmula**: mistura `×`, `→`, `·`, `=` e no FINAME finge ser produto (é PMT). Escrever a conta como fórmula de verdade, numa linha (`PMT(1,479% ao mês; 60 parcelas; R$ 407 mil)`), ou como livro-razão vertical (uma linha por parcela, valor à direita, operador na margem, resultado na última linha).
- **Caixa dentro de caixa é pesado** (painel cinza com caixas brancas de borda dentro). Moderno = sem painel, sem borda em caixa, filetes finos, um acento vermelho só, mais espaço em branco, o número grande solto.
- **Buraco na grade** quando a linha tem dois fatores e a grade reserva três (slide 3): o `=` fica longe. Fechar o `=` depois do último fator ou alinhar todas as linhas.
- **Rótulos de caixas com alturas diferentes** ("Compra cavalo + carroceria" em duas linhas, os outros em uma).
- **Informação importante não pode ficar na nota cinza de 11 px** (regra do FINAME BNDES; quitado/leasing/alugado sem parcela): vira cartão curto visível.
- **Distribuição vertical**: título alto, bloco no meio, um terço vazio embaixo. O conteúdo tem de ocupar a página.
- **Densidade**: slide 3 tem quatro fileiras de caixas + tabela + nota de duas linhas; se não couber limpo, a tabela vai para slide próprio.
- **Renan, na sequência: *"Quero fórmulas em formato de fórmula. Sem esse quadrados pintados com fundo etc. Feio pra cacete."*** Regra fechada: a memória de cálculo é escrita como equação (notação matemática, numerador ÷ denominador, parênteses, o resultado depois do `=`), em texto, sem caixa, sem fundo, sem fita de quadrados. A fita (`fita()`/`caixa()`/`contaColuna()` do `deck-manual.mjs`) e o slide 3 em grade de caixas saem inteiros.
- **Slides divisores de seção no layout escuro da capa, em TODOS os materiais** (Renan, 26/10/2026, com o print da capa do Manual: *"Coloque slide de título para dividir fixo e variável nesse layout. E o que mais achar que é grande grupo também. Em todos"*). Mesmo desenho da capa (fundo escuro, logo, kicker, título grande, uma frase), como as capas de seção do deck do Km/L remunerado (`capaSec()`). Divisão proposta, a confirmar:
  - **Manual**: Mapa (fica) → **T2 · Custo fixo** (FINAME, seguro, IPVA, rastreador/faixa/lavagem, total, parado) → **T2 · Custo variável** (combustível, Km/L, manutenção, carroceria, pneu, R$/km) → **T1 · Empurrada e Insumos** (frete da viagem, diesel, manutenção e pneu, demais componentes, fixo do cavalo e carreta) → **Armazém** (empilhadeira). O slide "Do caminhão à unidade: três contas no Resumo" fica depois do Mapa, antes da 1ª divisória.
  - **Análise 2026**: **Resultado** (números-chave, variável teto × pago, por conta, por unidade, remunerado DRE × FT) → **Combustível** (ponte, por unidade, Km/L remunerado e crédito) → **Manutenção** (regra, por unidade, por idade) → **Pneu e fixo** (pneu, financiamento, evolução do variável) → **Divergências** → **T1** (trecho, DRE, fixo) → **Receita**.
  - **Histórico**: **Receita e frota** → **Premissas** (caminhão, diesel) → **Resultado** (pago × DRE, manutenção, financiamento) → **T1** → **Divergências**.
  - **Treinamento**: **Como a remuneração funciona** (ideia, variável passo a passo, as quatro peças) → **Onde a operação ganha ou perde** (alavancas, parado) → **Empurrada** → **Rotina do gestor** (o que olhar, para levar).
- Diagnóstico geral: o desenho do DriverPro (narrativa) foi aplicado a um manual de referência e não serve para isso. Proposta: **padrão novo de slide de custo em duas colunas** (esquerda a conta em livro-razão, direita o número final grande com uma frase), montar em dois slides (FINAME e Combustível) para ele aprovar, só depois aplicar nos 21 do Manual e revisar Análise, Histórico e Treinamento com a mesma régua.

## 7. Segurança (não negociável)

Credenciais só em GitHub Secrets; CPFs nunca no repositório; nada com placas ou remuneração vai para o repositório (exports, xlsx, dumps, parquet, json/pkl, PDFs, HTML): tudo vai pelo chat; logs do Actions são públicos (nunca imprimir corpo, token ou valor); nunca rodar `scripts/fca-auto-acao.sql`; tokens moram em `portal_segredo`; a chave privada do dump fica só em `scratchpad/ftkey/priv.pem`.
