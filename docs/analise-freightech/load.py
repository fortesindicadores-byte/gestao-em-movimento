import gzip,json,collections,pandas as pd,os,re
D=os.environ.get('DUMP','../dump')
L=[json.loads(x) for x in gzip.open(f'{D}/ft-layout.ndjson.gz')]
lay={(l['canal'],l['tabela'],l['vigencia']):l['colunas'] for l in L}
os.makedirs('pq',exist_ok=True)
for canal in sorted({l['canal'] for l in L}):
    grupos=collections.defaultdict(list)
    for line in gzip.open(f'{D}/ft-{canal}.ndjson.gz'):
        r=json.loads(line); grupos[(r['t'],r['v'])].append(r['d'])
    portab=collections.defaultdict(list)
    for (t,v),rows in grupos.items():
        cols=lay[(canal,t,v)]
        # dedupe col names
        seen={};cc=[]
        for c in cols:
            n=seen.get(c,0); seen[c]=n+1; cc.append(c if n==0 else f'{c}__{n}')
        df=pd.DataFrame([r+[None]*(len(cc)-len(r)) for r in rows],columns=cc)
        df['_vig']=v
        m=re.search(r'_(\d)_(\d{1,2})_(\d{4})$',v); df['_ano']=int(m[3]);df['_mes']=int(m[2]);df['_qz']=int(m[1])
        portab[t].append(df)
    for t,dfs in portab.items():
        df=pd.concat(dfs,ignore_index=True)
        for c in df.columns:
            if df[c].dtype==object:
                s=pd.to_numeric(df[c],errors='coerce')
                if s.notna().sum()>=0.9*df[c].notna().sum() and df[c].notna().sum()>0: df[c]=s
                else: df[c]=df[c].astype(str).where(df[c].notna(),None)
        df.to_parquet(f'pq/{canal}__{t.replace(":","_")}.parquet')
        print(canal,t,df.shape)
