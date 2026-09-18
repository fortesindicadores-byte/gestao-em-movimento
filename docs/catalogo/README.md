# Catálogo de aplicação — o que pedir para cada modelo e placa

Pasta-fonte do painel **`/catalogo/`** e da carga no Supabase (workflow **Catalogo Carga**).
O JSON daqui é a FONTE; o banco (`cat_*`) é a cópia que o painel lê primeiro, com queda para estes arquivos.

| arquivo | o que é | gerado por |
|---|---|---|
| `aplicacoes.json` | UMA linha por modelo × item: especificação, quantidade, intervalo, referência, **status da pesquisa** (confirmado · inferido · nao_encontrado · nao_aplica), fonte e nota | `node scripts/catalogo-consolida.mjs` a partir de `pesquisa/raw/*.json` |
| `itens.json` | a LISTA de 1.191 itens genéricos da Frota (LISTA_PEÇAS_FINAL_IMPORTAR) com NCM e os **alertas** das regras da Política/Parecer | `node scripts/catalogo-itens.mjs` a partir de `pesquisa/Lista_de_Pecas_e_Servicos.xlsx` |
| `modelos-notas.json` | erros e duplicidades de CADASTRO achados na pesquisa (TOLEDO TM2500 é Paletrans; VW 18.310 não existe…) | à mão, das conclusões dos agentes |
| `sinonimos.json` | busca: "Racor" → Filtro separador de água, "Arla/AdBlue" → Arla 32, "cuíca"… | à mão |
| `pesquisa/modelos-cadastro.json` | os 90 modelos do cadastro (marca \| modelo), nº de ativos, tipos e anos | do Ativos_Frota.xlsx |
| `pesquisa/raw/r1-*.json` | 1ª rodada de pesquisa (17/09/2026): VW, MB, vans, empilhadeiras, implementos, NCM — cada agente no próprio formato | agentes de pesquisa (só WebSearch: o proxy bloqueia a leitura de páginas) |
| `pesquisa/raw/r2-*.json` | 2ª rodada (18/09/2026), já no formato plano, focada nas lacunas | idem |
| `pesquisa/catalogos-de-mercado.json` | levantamento dos catálogos que existem (EPCs das montadoras, TecDoc, Mann/Tecfil/Fleetguard…): acesso, custo, cobertura, API | agente de pesquisa |

**Como ler o status:** `confirmado` = fabricante/manual/catálogo de aplicação com URL (ou ≥2 fontes independentes); `inferido` = deduzido da família do motor ou de fonte única de varejo — conferir antes de comprar; `nao_encontrado` = a pesquisa não achou, e a `nota` diz onde procurar (manual, plaqueta, concessionária).

**Limite conhecido da pesquisa:** os agentes só tiveram busca (WebSearch), sem abrir página nenhuma (WebFetch bloqueado pelo proxy), e a cota de buscas é por sessão (200) — a 2ª rodada rodou com ~30–40 buscas por frente. Por isso há 532 linhas `nao_encontrado`: é lacuna de acesso, não ausência de fonte no mundo. Os PDFs que fechariam a maioria estão apontados nas notas.
