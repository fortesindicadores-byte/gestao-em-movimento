import gzip,json,pandas as pd
def sh(slug):
    it=[json.loads(x) for x in gzip.open(f'../dump/sh-{slug}.ndjson.gz')]
    b=it[0]['_base']; cols=sorted(b['colunas'],key=lambda c:c['i'])
    df=pd.DataFrame(it[1:])
    keep=[];names=[];seen={}
    for c in cols:
        n=(c.get('label') or '').strip() or f"c{c['i']}"
        k=seen.get(n,0);seen[n]=k+1; names.append(n if k==0 else f'{n}__{k}'); keep.append(c['col'])
    out=df[keep].copy(); out.columns=names
    out['_vigdb']=df['vigencia']
    return out
for s in ['dre_frota','dre_receita','dispersao_km','consumo_km_litro','consumo_rs_litro','consumo_rem_modelo']:
    sh(s).to_parquet(f'pq/sh_{s}.parquet')
