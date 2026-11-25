# Painel Apresentações · roteiro pedido pelo Renan (25/11/2026)

Anotado como ele escreveu. **Nada construído ainda: ele vai passar mais coisas antes.**

## Objetivo

Qualquer um, unidade ou corporativo, monta todo o material de apresentação no painel Apresentações.

## Ordem dos slides

1. **Capa**
2. **Sumário**
3. **Scorecard**: todos os cards do Resumo Gerencial, o gráfico do ano e os destaques, mas só cards. O único card em cima, no início, é a pontuação geral.
4. **Financeiro**: um card com o realizado e, abaixo, remunerado, ▲ Rem, ▲ Rem % e YoY. Abaixo, a Bridge do custo (Rem e Real em cinza; o verde e o vermelho das barras são verde e vermelho de verdade também na visão clara) e o gráfico do ano nominal.
5. **Financeiro 2**: % AH e AV.
6. **Dispersão de km**: o Resumo Gerencial da visão de km, trocando o gráfico de impacto financeiro por Bottom 10 placas.
7. **Árvore do custo**, abrindo só os pacotes que desviaram. Talvez um slide para custo e pacotes e outros para abrir os pacotes.
8. **FCAs depois de cada pacote aberto**: se o pacote desviou, vem a abertura da árvore e em seguida o FCA dele. Exemplo com manutenção e combustível: árvore de manutenção, FCA de manutenção, árvore de combustível, FCA de combustível. A ordem é do maior para o menor desvio.
9. **Termômetro**: Resumo Gerencial com Pontuação total (com MoM), Posição Geo, Posição Conlog, gráfico do ano (só mês, não quinzena) e Bottom KPIs.
10. **FCAs RPM**
11. **Frota de Elite**: Resumo Gerencial, com o ranking das unidades e a posição dela ao lado do gráfico do ano.

## Regras

- Visão dos painéis: não fugir muito do layout deles, adaptando para apresentação.
- Os slides das árvores têm espaço para a pessoa escrever comentário.

## Referência: o Apresentações do Bússola Gerencial (prints de 25/11/2026)

Três pedidos dele sobre a referência:

1. **Capa, sumário e encerramento iguais aos do Bússola.** Vale isto, no lugar do "inspiração, sem copiar" de 24/11. A versão de 23/11 (foto em tiras com filete laranja, título em serifa, barra laranja no pé) está no histórico do git e serve de ponto de partida.
2. **Cards, gráficos e tabelas se adaptam ao tamanho do slide**, bem adaptados: o conteúdo ocupa o slide inteiro, sem sobra e sem corte.
3. **Cada slide tem a opção de filtrar ou tirar o filtro.**

O que os prints mostram:

- **Capa:** metade esquerda preta com o logo CONLOG e o "TEM VALOR pra você, pra nós!", título em serifa branca, um filete vertical fino e "Outubro | 2026". À direita, a foto dos caminhões em tiras verticais de pontas arredondadas com contorno laranja. Barra laranja em degradê no pé.
- **Sumário:** logo no alto à esquerda, "Sumário" em serifa, traço laranja curto, "Outubro | 2026", duas colunas com o número da página em laranja e o nome do slide, separadas por filetes finos. Tiras da foto à direita e a barra laranja no pé.
- **Sequência da Apresentação (coluna da esquerda):** itens numerados com alça de arrastar, miniatura, nome e uma linha de estado ("Out/26 · 1ª de 2 · Filtros salvos"). Capa "Fixo no começo", sumário "Fixo após a Capa", encerramento "Fixo no fim". Contador no pé ("19 slides"). **O mesmo bloco entra mais de uma vez** (dre-fechamento 1ª de 2 e 2ª de 2), cada cópia com o próprio filtro.
- **Topo:** campo Título, botões Apresentar, Modo do apresentador (liga e desliga) e PowerPoint. Ano e Mês da capa valem para todos os blocos, e cada bloco ainda pode ser ajustado no próprio filtro.
- **Filtros por slide, acima do slide:** Operação, Filial, Projeto, Segmentos, botões de alternância (Lucro Líquido · Lucro Operacional; Mensal · Acumulado · Trimestre · Semestre) e "Abrir até" (Grupos · Operações · Unidades · Projetos).
- **Moldura do slide de conteúdo:** título no alto à esquerda com a etiqueta da entidade (Grupo Concórdia, Conlog), ícone de funil e o período no alto à direita ("Outubro/2026 · Mensal"), um filete colorido embaixo do cabeçalho e o conteúdo (tabela, Sankey) ocupando a largura e a altura do slide.

## O fio da história (Renan, 25/11/2026)

"Um verdadeiro storytelling, saindo de resultado e chegando ao nível de indicadores, FCA e reconhecimento. Minha metodologia." Visão bonita e clean, sem fugir do layout do portal.

Capítulos como eu li a ordem dele: **Resultado** (Scorecard, Financeiro, Financeiro 2) → **Por quê** (Dispersão de km, Árvore do custo por pacote) → **O que vamos fazer** (FCA de cada pacote) → **Indicadores** (Termômetro, FCAs RPM) → **Reconhecimento** (Frota de Elite).

### Decisões dele sobre as sugestões (25/11/2026)

- **Entra:** slide "o que prometemos no mês passado" (ações do FCA anterior: concluídas, vencidas, aderência), antes do Financeiro.
- **Entra:** slide "compromissos do mês" (ações com dono e prazo), antes do encerramento.
- **Entra:** divisória por capítulo.
- **Só se não poluir o slide:** a frase de conclusão montada dos dados, e o comentário em qualquer slide.
- **Árvore do custo sem a linha do Freightech** (só realizado contra remunerado do DRE), para a unidade conseguir abrir.
- **Corporativo:** o mesmo material, só com a opção de filtrar, com os filtros no padrão do portal. Sem regra especial de "maiores desvios".

### O FCA é preenchido nos dois lugares (Renan, 25/11/2026)

"Quero também que eles consigam fazer o FCA ali." Depois: "É preenchido dentro, mas também deve poder preencher fora, lá na visão FCA." A pessoa preenche causa, ação, dono e prazo no próprio slide do FCA ou no painel FCA, os dois gravando na mesma tabela `fca` oficial. O painel FCA continua sendo também o lugar do acompanhamento e do follow.

### Respostas fechadas (25/11/2026)

1. O card do Financeiro mostra o **custo** (realizado, remunerado, ▲ Rem, ▲ Rem % e YoY).
2. Os blocos do "farol de hoje" (Gestão à Vista) **saem**: a apresentação é de resultado do mês.
3. Painel de Metas e Auditorias **não entram**.

## Ordem final

Capa → Sumário → Divisória Resultado → O que prometemos no mês passado → Scorecard → Financeiro (custo) → Financeiro 2 (AH e AV) → Divisória Por quê → Dispersão de km → Árvore do custo (custo e pacotes) → para cada pacote que desviou, do maior para o menor: árvore do pacote, FCA do pacote → Divisória Indicadores → Termômetro → FCAs RPM → Divisória Reconhecimento → Frota de Elite → Compromissos do mês → Encerramento.

Próximo passo combinado: mock de três ou quatro slides (capa, um de resultado, uma árvore, um FCA) para aprovar o visual antes do resto.

## Visual aprovado no mock (25/11/2026)

Mock de 4 slides (capa, Financeiro, Árvore de um pacote, FCA). Ajustes dele: a linha embaixo do cabeçalho do slide é **cinza clarinha** (`#D9DCE2`, 1 px), não laranja; na Bridge, as barras de Remunerado e Realizado são **cinza escuro** (`#6B7280`). Cartões da árvore (Renan, 25/11/2026): **o realizado grande em cima, o remunerado menor logo abaixo, e embaixo a faixa ▲ · ▲ % · YoY**; no nó de Km e no de R$/km a faixa é **▲ · ▲ % · Impacto** (R$). Nunca repetir o realizado na faixa. O **gráfico do custo no ano segue o mensal da Visão Financeira** (barra do realizado vermelha ou verde contra o remunerado, o mês em foco cheio e os outros apagados, remunerado preto tracejado, orçado azul tracejado, rótulo só no foco, sem eixo Y). Depois (Renan, 25/11/2026): **fundo do slide = o do tema claro do portal**: cinza `#E1E2E5` com a luz branca suave no canto de cima à direita, **sem laranja nem azul** e cards de vidro claro; a **unidade ao lado do título é texto cinza** ("Piraí", separado por um filete), nunca pílula laranja; a **árvore fica solta no fundo**, sem card branco atrás (só os Comentários em card); a **Bridge e o Custo no ano têm o mesmo padrão**: o vermelho e o verde das barras são os mesmos nos dois, **vermelho e verde puros do tema claro (`#FF0000` e `#00B300`)**, preenchimento com contorno de 1 px e **barras quadradas** (sem canto arredondado), e na bridge o Remunerado e o Realizado ficam em cinza escuro, e **os dois ficam sem eixo Y e sem linhas de grade** (decisão final dele, depois de ver as duas versões), com os mesmos tamanhos de letra. A caixa de **Observações fica à direita da árvore** (ele testou à esquerda e voltou). O mock está em `scratchpad/mockap/mock.html` da sessão (não vai para o repositório).

## Estado do código

- `assets/apres-slides.js`: o motor dos slides no visual aprovado (capa, sumário, divisória e encerramento no desenho do Bússola; slide de conteúdo com cards, gráficos `ano`/`bridge`/`meta`/`faixa`/`barrasH`, nó da árvore, árvore com Observações e a tabela do FCA). O `--k` de cada slide é ajustado até o conteúdo caber.
- `apresentacoes/index.html`: o roteiro inteiro com os números dos painéis abertos por dentro; FCA editável no slide (a mesma caixa e a mesma tabela `fca` do painel FCA), filtro de projeto por slide, bloco repetido com o próprio filtro e observações das árvores gravadas no modelo.
- Teste: `scripts/apresentacoes-teste.mjs` (painéis dublados, `CHART_JS`, `SHOT_DIR`).
