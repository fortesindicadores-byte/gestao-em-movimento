# Lista por ANATOMIA — especificação para os agentes (rodada 3, 18/09/2026)

## Por que existe

A lista atual de 1.191 itens nasceu do histórico de compra do Benner (12 meses).
Peça que a garantia ou o contrato VW/MB cobriu **nunca entrou**: a frota tem 14
famílias de motor e a lista **não tem um virabrequim sequer** (só o de compressor
de oficina). Serviços: zero. O Renan vai virar o cadastro INTEIRO de peças e
serviços para esta lista, então ela tem de ser feita da anatomia do equipamento
— sistema → conjunto → peça —, não do que se comprou.

## O que a frota tem (cadastro real, 941 ativos)

- **Caminhões** (434 ativos, 27 modelos): VW Constellation 26.260/30.280/30.320/28.460 e
  23.230 (MAN D08 4 e 6 cil, D26), VW 13.180/11.180 (Cummins ISF 3.8), Constellation
  19.330 (Cummins ISL), VW 17.190/18.210 Delivery, MB Atego 2426/3026/2425 (OM 926),
  Accelo 1316/1317 (OM 924), Atron 1719, Actros 2548S/2651/2546 (OM 460), Volvo FH 460
  (D13C), Scania R 540 (DC13), Iveco Tector 310E2 (NEF), MAN TGX 29.480 (D26).
  Configurações: VUC, toco, truck, bi-truck, cavalo mecânico. Freio pneumático
  (S-came e disco), suspensão de feixe e pneumática, câmbio manual e automatizado,
  pós-tratamento EGR (sem Arla) e SCR (com Arla), Euro 5 e Euro 6.
- **Vans** (~33): Renault Master (M9T 2.3), Iveco Daily 30-130 (F1A), MB Sprinter (OM 651).
  Freio hidráulico a disco, correia dentada, injeção common rail.
- **Implementos/carrocerias**: baú de bebidas Ambev (portas roll-up Portabrás, baias,
  assoalho, cortinas), frigorífico Frigoking (Seara/Anhanguera — painéis isotérmicos,
  unidade de frio, portas), empurrada = semirreboque (pino-rei, patolas, suspensão,
  eixos, freios ABS/EBS, lonas, sider), carroceria aberta/grade baixa. Facchini,
  Randon, Librelato, Truckvan.
- **Empilhadeiras** GLP (Yale GLP50VX / Toyota 4Y / PSI 2.4 L, Hyster) e elétricas
  (Heli CPD25/CPD38 lítio 80 V, BYD, Yale ERP), transpaleteiras elétricas,
  paleteiras manuais (Paletrans TM2500, BYG) e com balança (célula de carga),
  máquinas de limpeza (lavadora/varredeira Nilfisk, Karcher), sopradores,
  macacos/talhas/cavaletes.
- **Frota leve**: pick-ups e carros de apoio.

## Formato de saída — UM arquivo JSON por agente

`docs/catalogo/pesquisa/raw/r3-<frente>.json`:

```json
{
  "frente": "motor",
  "gerado_em": "2026-09-18",
  "itens": [
    {
      "grupo": "Veículo",                 // Veículo · Van · Implemento · Equipamento · Comum · Serviço
      "familia": "Motor",                 // sistema grande (Motor, Freios, Transmissão, Carroceria…)
      "sistema": "Bloco e cabeçote",      // subsistema
      "conjunto": "Árvore de manivelas",  // opcional: o conjunto de que a peça faz parte
      "peca": "Virabrequim",              // nome GENÉRICO, sem marca, sem modelo, sem código
      "material": "Aço forjado",          // material principal
      "unidade": "UN",                    // UN · JG · KIT · PAR · L · KG · M · CX
      "ncm": "8483.10.10",                // 8 dígitos com pontos; "" se não souber
      "ncm_confianca": "alta",            // alta · media · baixa
      "aplica": ["CAMINHAO", "VAN"],      // CAMINHAO · VAN · IMPLEMENTO · EMPILHADEIRA_GLP · EMPILHADEIRA_ELETRICA · PALETEIRA · LIMPEZA · SOPRADOR · ELEVACAO · FROTA_LEVE · TODOS
      "servico": false,
      "nota": ""                          // só quando muda a compra (ex.: "Euro 6 usa filtro diferente")
    }
  ]
}
```

## Regras

1. **Granularidade de peça de reposição**: o que se pede numa requisição. "Bomba
   d'água", "Junta da bomba d'água", "Polia da bomba d'água" são TRÊS itens.
   Kits que o mercado vende como kit (kit de embreagem, kit de reparo do cilindro
   mestre, jogo de juntas do motor) entram como item próprio, além das peças.
2. **Sem marca, sem modelo, sem código** no nome. Variante que muda a compra vai
   no nome entre parênteses: "Filtro de ar do motor (primário)", "Lona de freio
   (eixo dianteiro)", "Filtro de combustível (separador de água)".
3. **NCM**: 8 dígitos da TIPI. Regras já fechadas com o Fiscal: filtro de ar do
   motor 8421.31.00 ≠ filtro de óleo/combustível 8421.23.00 ≠ filtro de cabine
   8421.39.90; óleo lubrificante mineral/Grupo III 2710.19.32, sintético base
   PAO/éster 3403.19.00; fixador de nylon 3926.90.90; porta de baú de caminhão
   8708.29.99, de semirreboque 8716.90.90 (nunca 7610.10); bateria de chumbo
   8507.10.10; pneu de caminhão 4011.20.90; virabrequim 8483.10.10; bronzina
   8483.30.20; pistão 8409.99.14; bomba injetora 8413.30.10; turbo 8414.80.19;
   radiador 8708.91.00; embreagem 8708.93.00; amortecedor 8708.80.00; freios
   e partes 8708.30.90; caixa de câmbio 8708.40.80; eixo 8708.50.xx. Se não
   souber, deixe "" e `ncm_confianca:"baixa"` — NÃO chute.
4. **Serviços** (só a frente `servicos`): "Serviço de mão de obra — troca de
   pneu", "Serviço de lavação de veículo", "Contrato de manutenção — fabricante"…
   `servico:true`, unidade `SV` ou `H`, NCM "" e o campo `nbs` opcional.
5. **Sem web search** — é anatomia de mecânica, conhecimento consolidado; a cota
   de busca da sessão é compartilhada e está quase no fim. Use busca só se um
   NCM específico estiver em dúvida real e for relevante (máx. 5 buscas).
6. Não repita item dentro do arquivo (mesmo `peca` + `material`). A consolidação
   entre frentes é feita depois por script — sobreposição entre frentes é
   aceitável (ex.: rolamento aparece em Motor e em Cubo), o script dedupa.
7. Volume esperado por frente: 350–700 itens. Melhor completo que curto —
   a pergunta do Renan foi exatamente "cobre TODOS os caminhões?".
8. Escreva o arquivo com a ferramenta Write, JSON válido, UTF-8, e responda
   só com: caminho do arquivo, nº de itens, nº por família, e o que ficou de
   fora e por quê.
