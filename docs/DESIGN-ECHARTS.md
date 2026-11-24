# Gestão em Movimento · Padrão visual com ECharts

Guia de referência para criar e manter os painéis do Gestão em Movimento. Toda tela nova parte daqui: cores, tipografia, layout, blocos de infográfico e configuração do ECharts.

Versão aprovada em 24/11/2026.

---

## 1. Stack

| Item | Versão / origem | Observação |
| --- | --- | --- |
| Apache ECharts | `echarts@5.5.1` (jsDelivr) | Licença Apache 2.0, uso comercial livre, sem logo |
| Plugin liquid-fill | `echarts-liquidfill@3.1.0` (jsDelivr) | Só nas páginas que usam o "tanque" |
| Fonte | Inter 400 / 500 / 600 (Google Fonts) | Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif` |
| Ícones | Tabler Icons (outline) | Conferir a licença antes de usar em produto vendido |
| Tema visual | `assets/gem-theme.css` | Variáveis CSS, claro e escuro |
| Tema dos gráficos | `assets/gem-echarts.js` | Registra `gem-dark` e `gem-light` e expõe o objeto `GEM` |

Ordem de carregamento em toda página:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/gem-theme.css">

<!-- no fim do body -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-liquidfill@3.1.0/dist/echarts-liquidfill.min.js"></script>
<script src="assets/gem-echarts.js"></script>
```

Regra: versões sempre fixas na URL. Nunca usar `@latest` nem versão sem número.

---

## 2. Princípios

1. **O número vem primeiro.** Cada card responde uma pergunta. O valor é o maior elemento do card.
2. **Toda métrica tem referência.** Meta, mês anterior ou ano anterior sempre ao lado do valor.
3. **Cor só com significado.** Laranja = dado. Verde e vermelho = desvio em relação à meta, sempre com seta (▲ ▼) e sinal.
4. **A fonte aparece.** Todo card mostra a origem do dado e a data de atualização no rodapé.
5. **Infográfico para explicar, painel para acompanhar.** Cenas ilustradas só nos indicadores-síntese. O restante usa blocos simples.

---

## 3. Cores

### 3.1 Tokens

| Token | Escuro | Claro | Uso |
| --- | --- | --- | --- |
| `--gem-bg` | `#0F172A` | `#F1F5F9` | Fundo da página |
| `--gem-card` | `#1E293B` | `#FFFFFF` | Fundo de cards e gráficos |
| `--gem-line` | `#334155` | `#E2E8F0` | Bordas, divisórias, grade dos gráficos |
| `--gem-ink` | `#FFFFFF` | `#0F172A` | Texto principal, valores, rótulos do eixo X |
| `--gem-muted` | `#94A3B8` | `#64748B` | Texto secundário, rótulos do eixo Y |
| `--gem-foot` | `#64748B` | `#64748B` | Rodapé (fonte e data) |
| `--gem-primary` | `#F97316` | `#EA580C` | Barras e série principal |
| `--gem-secondary` | `#FDBA74` | `#9A3412` | Segunda série / comparativo |
| `--gem-accent` | `#FB923C` | `#C2410C` | Texto em laranja (destaques, unidades) |
| `--gem-chip-bg` | `#F97316` | `#C2410C` | Chip ou botão selecionado |
| `--gem-chip-ink` | `#0F172A` | `#FFFFFF` | Texto sobre o chip selecionado |
| `--gem-pos` | `#34D399` | `#047857` | Variação favorável |
| `--gem-neg` | `#F87171` | `#DC2626` | Variação desfavorável |
| `--gem-warn` | `#FBBF24` | `#B45309` | Atenção / perto do limite |

Composição de custo (4 fatias, nesta ordem):

| Posição | Escuro | Claro |
| --- | --- | --- |
| 1 | `#F97316` | `#EA580C` |
| 2 | `#FDBA74` | `#9A3412` |
| 3 | `#64748B` | `#94A3B8` |
| 4 | `#334155` | `#CBD5E1` |

### 3.2 Regras de contraste

- Contraste mínimo: 4,5:1 para texto e 3:1 para elementos gráficos.
- O laranja muda de tom entre os temas de propósito. No claro, `#FDBA74` sobre branco fica em 1,7:1, ilegível. Por isso a segunda série vira `#9A3412`.
- No escuro, o chip laranja usa texto escuro (`#0F172A`). Texto branco sobre `#F97316` fica abaixo de 4,5:1.
- Para texto laranja, use sempre `--gem-accent`, nunca `--gem-primary`.
- Duas séries no mesmo gráfico se distinguem por luminosidade (primária + secundária), não só por tom.
- Verde e vermelho nunca aparecem sozinhos: sempre com seta e sinal.

---

## 4. Tipografia

| Estilo | Tamanho / altura | Peso | Uso |
| --- | --- | --- | --- |
| Título da página | 22px / 30px | 600 | "Gestão em Movimento · Frota" |
| Valor de KPI | 32px / 40px | 600 | Número principal do card |
| Valor de destaque (cena) | 42px | 500 | Número da cena de abertura |
| Título de card | 15px / 22px | 600 | Com a unidade entre parênteses |
| Texto | 13–14px / 20px | 400 | Frases de apoio |
| Rótulo | 12px / 16px | 500, MAIÚSCULAS, espaçamento .05em | Nome do KPI, cabeçalho de tabela |
| Rodapé | 11px / 14px | 400 | Fonte e data |

Números sempre com algarismos tabulares (`font-variant-numeric: tabular-nums`), já aplicado no `body` pelo `gem-theme.css`.

---

## 5. Formatos

| Tipo | Padrão | Função |
| --- | --- | --- |
| Data | `dd/MM/yyyy` (24/11/2026) | `data.toLocaleDateString('pt-BR')` |
| Mês de referência | `nov/2026` | texto |
| Número | 1.248.390 | `GEM.num(v)` |
| Decimal | 2,9 | `GEM.num(v, 1)` |
| Moeda | R$ 1.248.390 / R$ 2,47 | `GEM.brl(v)` / `GEM.brl(v, 2)` |
| Percentual | 4,2% | `GEM.pct(v)` |
| Variação | `+4,2%` / `−1,8%`, com ▲ ▼ | texto + classe `gem-pos` / `gem-neg` |

Unidade no título, entre parênteses: "Custo por km (R$/km)", "Disponibilidade (%)".

---

## 6. Layout

- Grade de 12 colunas (`.gem-grid`), margem 24px, vão de 16px entre cards.
- Card (`.gem-card`): fundo `--gem-card`, borda 1px `--gem-line`, raio 14px, padding 16px, sem sombra.
- Todo gráfico fica dentro de um `div` com altura definida (`.gem-chart`, padrão 260px).

Ordem de leitura da página:

| Faixa | Conteúdo | Largura |
| --- | --- | --- |
| 1. Cabeçalho | Título, data de atualização, filtros, botão claro/escuro | 12 colunas |
| 2. Cena de abertura | Indicador-síntese do mês (tanque + número) | 12 colunas |
| 3. Faixa de KPIs | 3 blocos: número em destaque, velocímetro, pictograma | 4 + 4 + 4 |
| 4. Operação | Fluxo de manutenção + composição do custo / ranking pictórico | 8 + 4 |
| 5. Detalhe | Estrada de revisões (visão por veículo) ou tabela | 12 colunas |

---

## 7. Blocos de infográfico

| Bloco | Recurso ECharts | Quando usar |
| --- | --- | --- |
| Tanque | `liquidFill` (plugin) | Atingimento de meta em %, um por página |
| Velocímetro | `gauge` com `progress` | Disponibilidade, aderência, % de meta |
| Pictograma 3 em 10 | `pictorialBar` + `symbolRepeat` numérico | Proporção da frota em uma condição |
| Ranking pictórico | `pictorialBar` + `symbolClip` + `symbolBoundingData` | Contagens por filial (1 caminhão = N unidades) |
| Composição | `bar` empilhada horizontal | Divisão do custo em até 4 partes |
| Número em destaque | HTML (ícone + valor + frase) | Indicador com impacto financeiro |
| Fluxo | HTML (ícones + setas) | Etapas de processo com volume |
| Estrada de marcos | SVG próprio | Revisões por km de um veículo |
| Pódio | SVG próprio ou `bar` | Top 3 de filiais |

Regras:
- Cenas ilustradas (tanque, estrada, pódio) no máximo duas por página.
- No pictograma, sempre dizer quanto vale cada ícone ("cada caminhão = 5 OS").
- Barra comum para comparar itens, linha para tendência no tempo. Pizza não entra no padrão; use a composição empilhada.
- Meta como linha tracejada em `--gem-muted`, com o valor no rótulo.

---

## 8. Como criar um gráfico

Todo gráfico é criado com `GEM.chart`. A função recebe a paleta do tema atual (`t`) e devolve a opção do ECharts. Assim o gráfico se redesenha sozinho quando o usuário troca entre claro e escuro.

```js
GEM.chart('id-do-div', function (t) {
  return {
    xAxis: { type: 'category', data: ['jun', 'jul', 'ago'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [412, 468, 355], itemStyle: { color: t.primary } }]
  };
});
```

Campos de `t` disponíveis: `bg`, `card`, `ink`, `muted`, `line`, `off`, `primary`, `secondary`, `accent`, `target`, `series`, `pos`, `neg`.

Troca de tema (a escolha fica salva no navegador):

```js
GEM.setTheme('light'); // ou 'dark'
```

### 8.1 Tanque (liquid-fill)

```js
GEM.chart('tanque', function (t) {
  return { series: [{
    type: 'liquidFill', data: [0.65, 0.6], radius: '85%', shape: 'roundRect',
    color: [t.primary, t.accent],
    backgroundStyle: { color: t.bg, borderColor: t.line, borderWidth: 2 },
    outline: { show: false },
    label: { formatter: '65%', fontSize: 24, color: t.ink, insideColor: '#FFFFFF' }
  }] };
});
```

### 8.2 Velocímetro

```js
GEM.chart('velocimetro', function (t) {
  return { series: [{
    type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, center: ['50%', '60%'],
    progress: { show: true, width: 14, itemStyle: { color: t.primary } },
    axisLine: { lineStyle: { width: 14, color: [[1, t.line]] } },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
    detail: { offsetCenter: [0, '5%'], fontSize: 26, color: t.ink, formatter: function (v) { return GEM.num(v) + '%'; } },
    data: [{ value: 87 }]
  }] };
});
```

### 8.3 Pictograma "3 em cada 10"

```js
GEM.chart('pictograma', function (t) {
  return {
    grid: { left: 4, right: 4, top: 6, bottom: 6 },
    xAxis: { type: 'value', max: 10, show: false },
    yAxis: { type: 'category', data: ['a'], show: false },
    series: [
      { type: 'pictorialBar', symbol: GEM.truck, symbolRepeat: 10, symbolSize: [30, 20], symbolPosition: 'start',
        itemStyle: { color: t.off }, data: [10], z: 1, silent: true },
      { type: 'pictorialBar', symbol: GEM.truck, symbolRepeat: 3, symbolSize: [30, 20], symbolPosition: 'start',
        itemStyle: { color: t.primary }, data: [3], z: 2, barGap: '-100%' }
    ]
  };
});
```

### 8.4 Ranking pictórico

```js
GEM.chart('ranking', function (t) {
  var max = 60;
  return {
    grid: { left: 80, right: 70, top: 6, bottom: 6 },
    xAxis: { type: 'value', max: max, show: false },
    yAxis: { type: 'category', data: ['Curitiba', 'Joinville', 'Itajaí'], axisLine: { show: false } },
    series: [
      { type: 'pictorialBar', symbol: GEM.truck, symbolRepeat: true, symbolSize: [30, 19], symbolMargin: 4,
        symbolClip: true, symbolBoundingData: max, itemStyle: { color: t.primary }, z: 2, data: [30, 41, 52],
        label: { show: true, position: 'right', offset: [8, 0], color: t.ink,
                 formatter: function (p) { return GEM.num(p.value) + ' OS'; } } },
      { type: 'pictorialBar', symbol: GEM.truck, symbolRepeat: true, symbolSize: [30, 19], symbolMargin: 4,
        symbolBoundingData: max, itemStyle: { color: t.line }, z: 1, silent: true, animation: false,
        data: [max, max, max] }
    ]
  };
});
```

### 8.5 Composição do custo

```js
GEM.chart('composicao', function (t) {
  var partes = [['Combustível', 52], ['Manutenção', 24], ['Pneus', 14], ['Outros', 10]];
  return {
    grid: { left: 0, right: 0, top: 0, bottom: 24 },
    xAxis: { type: 'value', max: 100, show: false },
    yAxis: { type: 'category', data: ['c'], show: false },
    legend: { bottom: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: t.muted },
      formatter: function (n) { var x = partes.find(function (i) { return i[0] === n; }); return n + ' ' + x[1] + '%'; } },
    series: partes.map(function (p, k) {
      return { name: p[0], type: 'bar', stack: 'total', barWidth: 18, data: [p[1]],
        itemStyle: { color: t.series[k], borderRadius: k === 0 ? [5, 0, 0, 5] : (k === partes.length - 1 ? [0, 5, 5, 0] : 0) } };
    })
  };
});
```

---

## 9. Regras dos gráficos

- Eixo X sempre visível, com rótulos em `--gem-ink`.
- Eixo Y sem linha, rótulos em `--gem-muted`, grade tracejada em `--gem-line`.
- Barras com topo arredondado (6px).
- Rótulo de valor sobre a barra quando houver até 12 barras. Acima disso, só tooltip.
- Todo número exibido (eixo, rótulo, tooltip) passa por `GEM.num`, `GEM.brl` ou `GEM.pct`.
- Fundo do gráfico sempre transparente: quem pinta o fundo é o card.

---

## 10. Tabelas

Tabela é simples: só texto e números. Sem barras de dados, sem minigráficos, sem selos e sem listras zebradas.

Regras:
- Cabeçalho em maiúsculas pequenas, cor `--gem-muted`.
- Números alinhados à direita (classe `num`), com algarismos tabulares.
- Linhas separadas por traço fino em `--gem-line`.
- A única cor da tabela é a variação contra a meta: `pos` ou `neg`, sempre com seta (▲ ▼).
- Em custo, ▼ é favorável (`pos`). Em disponibilidade, ▲ é favorável.
- Rodapé abaixo da tabela com as metas, a fonte e a data de atualização.

```html
<section class="gem-card">
  <p class="gem-title">Indicadores por filial · nov/2026</p>
  <table class="gem-table">
    <thead>
      <tr><th>Filial</th><th class="num">Veículos</th><th class="num">R$/km</th><th class="num">vs meta</th><th class="num">Disponib.</th><th class="num">vs meta</th></tr>
    </thead>
    <tbody>
      <tr><td>Itajaí</td><td class="num">84</td><td class="num">2,31</td><td class="num pos">▼ 9,4%</td><td class="num">94%</td><td class="num pos">▲ 2 p.p.</td></tr>
      <tr><td>Curitiba</td><td class="num">71</td><td class="num">2,74</td><td class="num neg">▲ 7,5%</td><td class="num">83%</td><td class="num neg">▼ 9 p.p.</td></tr>
    </tbody>
  </table>
  <p class="gem-foot">Meta R$/km 2,55 · meta disponibilidade 92% · Fonte: base de custos e OS · 24/11/2026</p>
</section>
```

---

## 11. Dados

Cada página tem uma única função `carregarDados()` que busca no banco e devolve um objeto simples. Os gráficos só leem esse objeto.

Motivo: o projeto vai migrar de banco de dados. Com essa separação, só `carregarDados()` muda na migração; gráficos e layout ficam intactos.

---

## 12. Checklist antes de publicar uma tela

- [ ] Carrega `gem-theme.css` e `gem-echarts.js`, com as versões fixas do ECharts
- [ ] Todo gráfico criado com `GEM.chart`
- [ ] Testada nos temas claro e escuro
- [ ] Todo KPI tem referência (meta ou período anterior)
- [ ] Variações com seta e sinal, não só cor
- [ ] Datas e números no padrão brasileiro
- [ ] Rodapé com fonte e data de atualização em todos os cards
- [ ] No máximo duas cenas ilustradas na página
- [ ] Pictogramas dizem quanto vale cada ícone
- [ ] Tabelas no modelo simples (seção 10), com cor só na variação contra a meta
