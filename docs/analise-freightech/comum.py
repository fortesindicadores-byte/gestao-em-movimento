import pandas as pd, numpy as np, re
pd.set_option('display.width',260,'display.max_rows',400,'display.max_columns',60)
FTU={'CDD CAMBORIU':'BLC','CDD CUIABA':'CBA','CDD FLORIANOPOLIS':'FLP','CDD GUARULHOS':'GRL','CDD NOVA FRIBURGO':'NFR','CDD PELOTAS':'PLT','CDD RIO DE JANEIRO':'CGR','CDD RONDONOPOLIS':'RON','MACACU':'MCC','UDC GUARULHOS':'GRL'}
def ft(c,t): return pd.read_parquet(f'pq/{c}__{t}.parquet')
def sh(s): return pd.read_parquet(f'pq/sh_{s}.parquet')
PAC={'Combustíveis':'comb','Arla':'comb','ICMS Crédito Presumido':'icms','Estorno de ICMS não Aproveitado':'icms',
 'Manutenção de Veículos e Equipamentos':'manut','Contratos de Manutenção Fabricante':'manut','Manutenção de Carrocerias':'manut','Materiais e Ferramentas de Oficina':'manut','Personalização e Padronização de Veículos':'manut',
 'Pneus Novos':'pneu','Recapagens e Outros Serviços':'pneu','Lavação de Veículos':'lav','IPVA e Licenciamento de Veículos':'ipva','Seguro de Veículos e Equipamentos':'seguro'}
def dre():
    d=sh('dre_frota').copy()
    d['vig']=pd.to_datetime(d['VIGÊNCIA']).dt.strftime('%Y-%m')
    d['proj']=d['NÍVEL 3'].str.replace(r'\s*\(INATIVO\)','',regex=True).str.split(' - ').str[0].str.strip()
    d['cod']=d['NÍVEL 3'].str.replace(r'\s*\(INATIVO\)','',regex=True).str.split(' - ').str[-1].str.strip().replace({'GOI':'GNA'})
    d['pac']=d['CONTA GERENCIAL'].map(PAC).fillna('outro')
    d['rem']=-d['REMUNERADO']; d['real']=-d['REALIZADO']
    return d
def resumo_rota():
    r=ft('ROTA','Resumo'); v=ft('ROTA','ResumoVan')
    v=v.rename(columns={'combustivelReaisKm':'Combustível R$/KM','manutencaoCaminhaoReaisKm':'Manutenção Caminhão R$/KM','manutencaoCarroceriaReaisKm':'Manutenção Carroceria R$/KM','pneuReaisKm':'Pneu R$/KM','kmRemunerado':'KM Remunerado','totalCaminhaoAtivo':'Total Caminhão Ativo','totalViagens':'Total Viagens','lavagem':'Lavagem','totalFrotaAtiva':'Total Frota Ativa','totalFrotaParada':'Total Frota Parada','totalEquipeEntrega':'Total Equipe Entrega','totalQlpAdm':'Total QLP ADM','totalOutrasDespesas':'Total Outras Despesas','totalCaminhaoParado':'Total Caminhão Parado','ipvaLicencMensal':'IPVA Licen. Mensal','ipvaLicencMensalParado':'IPVA Licenc. Mensal Parado','seguro':'Seguro','seguroParado':'Seguro Parado','totalReaisKm':'Total R$/KM'})
    r['tipo']='CAMINHAO'; v['tipo']='VAN'
    x=pd.concat([r,v],ignore_index=True)
    x['cod']=x['Unidade - Nome'].map(FTU); x['vig']=x._ano.astype(str)+'-'+x._mes.astype(str).str.zfill(2)
    n=x['Total Caminhão Ativo']; km=x['KM Remunerado']
    x['comb']=x['Combustível R$/KM']*km*n; x['manut']=(x['Manutenção Caminhão R$/KM']+x['Manutenção Carroceria R$/KM'])*km*n; x['pneu']=x['Pneu R$/KM']*km*n
    x['lav']=x['Lavagem']*n; x['ipva']=x['IPVA Licen. Mensal']*n+x['IPVA Licenc. Mensal Parado']*x['Total Caminhão Parado']
    x['kmtot']=km*n
    return x
