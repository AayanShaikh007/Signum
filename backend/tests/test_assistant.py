import asyncio
import functools
import json
from unittest.mock import patch
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.assistant import DraftRequest, Proposal, assistant_router, generate, retrieve, SearchPlan
from backend.strategies import Strategy, StrategyStore

def sync_test(function):
    @functools.wraps(function)
    def run(): return asyncio.run(function())
    return run

CONFIG={'ENDPOINT':'https://example.openai.azure.com','DEPLOYMENT':'test','API_VERSION':'test','API_KEY':'test-secret'}

def proposal(**changes):
    result={'supported':True,'explanation':'Test reversion','spec':Strategy().model_dump(),
            'evidence':[{'source_id':'S1','finding':'Metadata only; no empirical finding.','limitation':'No abstract'}],
            'parameter_reasoning':'Guesses to test','risks':['Losses and costs']}
    result.update(changes)
    return result

def completion_reply(request, value):
    body=json.loads(request.content)
    if body['response_format']['json_schema']['name']=='SearchPlan':
        value={'query':'stock market mean reversion trading','topic_terms':['mean','reversion']}
    return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':json.dumps(value)}}]})


def handler(request):
    if request.method=='GET':
        return httpx.Response(200,json={'message':{'items':[{'DOI':'10.1234/test','title':['Stock mean reversion trading'],'abstract':'<p>Test abstract</p>'}]}})
    return completion_reply(request,proposal())

@sync_test
async def test_draft_mapping_sources_and_hypothesis():
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result=await generate(DraftRequest(hypothesis='Prices might revert after small falls'),client,CONFIG)
    assert result['sources'][0]['url']=='https://doi.org/10.1234/test'
    assert result['sources'][0]['abstract']=='Test abstract'
    assert result['proposal']['spec']['hypothesis']=='Prices might revert after small falls'
    assert result['fpga_supported']
    assert 'test-secret' not in json.dumps(result)

@sync_test
async def test_unknown_citation_rejected():
    def bad(request):
        if request.method=='GET':return handler(request)
        value=proposal(evidence=[{'source_id':'invented','finding':'Claim','limitation':'Unknown'}])
        return completion_reply(request,value)
    async with httpx.AsyncClient(transport=httpx.MockTransport(bad)) as client:
        with pytest.raises(ValueError):await generate(DraftRequest(hypothesis='A valid hypothesis about falling prices'),client,CONFIG)

@sync_test
async def test_timeout_propagates_without_retry():
    calls=[]
    def fail(request):
        calls.append(request);raise httpx.ReadTimeout('secret internal details',request=request)
    async with httpx.AsyncClient(transport=httpx.MockTransport(fail)) as client:
        with pytest.raises(httpx.ReadTimeout):await generate(DraftRequest(hypothesis='A valid hypothesis about falling prices'),client,CONFIG)
    assert len(calls)==1

def test_schema_rejects_executable_and_out_of_range():
    with pytest.raises(ValueError):Proposal(**proposal(spec=dict(Strategy().model_dump(),threshold_ticks=0)))
    with pytest.raises(ValueError):Proposal(**proposal(code='execute'))

def test_api_configuration_persistence_and_rate_limit(tmp_path):
    app=FastAPI();app.include_router(assistant_router(StrategyStore(tmp_path)))
    async def fake(*args):return {'id':'a'*32,'proposal':proposal(),'sources':[]}
    with TestClient(app) as client, patch('backend.assistant.settings',return_value=CONFIG),patch('backend.assistant.generate',side_effect=fake):
        assert client.get('/api/assistant/status').json()['configured']
        assert client.post('/api/assistant/drafts',json={'hypothesis':'tiny'}).status_code==422
        for _ in range(10):assert client.post('/api/assistant/drafts',json={'hypothesis':'Prices may revert after a decline'}).status_code==200
        assert client.post('/api/assistant/drafts',json={'hypothesis':'Prices may revert after a decline'}).status_code==429
    assert (tmp_path/'ai_drafts'/('a'*32+'.json')).exists()

def test_unconfigured_and_sanitized_errors(tmp_path):
    app=FastAPI();app.include_router(assistant_router(StrategyStore(tmp_path)))
    with TestClient(app) as client:
        with patch('backend.assistant.settings',return_value=dict(CONFIG,API_KEY='')):
            assert client.post('/api/assistant/drafts',json={'hypothesis':'Prices may revert after a decline'}).status_code==503
        with patch('backend.assistant.settings',return_value=CONFIG),patch('backend.assistant.generate',side_effect=httpx.ReadTimeout('secret')):
            r=client.post('/api/assistant/drafts',json={'hypothesis':'Prices may revert after a decline'})
            assert r.status_code==502 and 'secret' not in r.text

@sync_test
async def test_unsupported_not_hardware_eligible_and_truncation_rejected():
    def unsupported(request):
        if request.method=='GET':return handler(request)
        return completion_reply(request,proposal(supported=False))
    async with httpx.AsyncClient(transport=httpx.MockTransport(unsupported)) as client:
        value=await generate(DraftRequest(hypothesis='Use a new unsupported momentum strategy'),client,CONFIG)
        assert not value['fpga_supported'] and not value['proposal']['supported']
    def truncated(request):
        if request.method=='GET':return handler(request)
        return httpx.Response(200,json={'choices':[{'finish_reason':'length','message':{'content':'{}'}}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(truncated)) as client:
        with pytest.raises(ValueError):await generate(DraftRequest(hypothesis='Prices might revert after a decline'),client,CONFIG)


def test_drafted_spec_uses_existing_freeze_and_backtest(tmp_path):
    from backend.research_api import research_router
    app=FastAPI();store=StrategyStore(tmp_path)
    app.include_router(assistant_router(store));app.include_router(research_router(store))
    async def fake(*args):return {'id':'b'*32,'proposal':proposal(),'sources':[]}
    with TestClient(app) as client,patch('backend.assistant.settings',return_value=CONFIG),patch('backend.assistant.generate',side_effect=fake):
        drafted=client.post('/api/assistant/drafts',json={'hypothesis':'Prices may revert after a decline'}).json()
        saved=client.post('/api/research/strategies',json={'spec':drafted['proposal']['spec']}).json()
        frozen=client.post(f"/api/research/strategies/{saved['id']}/freeze",json={'expected_revision':saved['revision']}).json()
        result=client.post('/api/research/backtests',json={'snapshot_id':frozen['id'],'dataset_id':'demo','phase':'development','fee_bps':1,'slippage_bps':2})
        assert result.status_code==200 and 'final_equity' in result.json()['summary']

@sync_test
async def test_retrieval_filters_unrelated_records_and_keeps_working_papers():
    seen=[]
    def search(request):
        seen.append(request)
        return httpx.Response(200,json={'message':{'items':[
            {'DOI':'10.1000/minutes','title':['APSA Council Minutes May 7, 1982']},
            {'DOI':'10.1000/obituary','title':['OBITUARY. ALFRED UPWARD']},
            {'DOI':'10.1000/generic','title':['Stock market opening hours']},
            {'DOI':'10.1000/orb','title':['Opening range breakout stock trading &lt;br&gt;'], 'container-title':None},
            {'DOI':'10.1000/orb','title':['Opening range breakout stock trading']}]}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(search)) as client:
        sources=await retrieve(client,SearchPlan(query='opening range breakout stock trading',topic_terms=['opening range','breakout']))
    assert [s['doi'] for s in sources]==['10.1000/orb']
    assert sources[0]['title']=='Opening range breakout stock trading'
    assert seen[0].url.params['query.bibliographic']=='opening range breakout stock trading'
    assert 'filter' not in seen[0].url.params

@sync_test
async def test_no_relevant_sources_remains_honest_and_still_checks_support():
    def empty(request):
        if request.method=='GET':return httpx.Response(200,json={'message':{'items':[]}})
        return completion_reply(request,proposal(supported=False,evidence=[]))
    async with httpx.AsyncClient(transport=httpx.MockTransport(empty)) as client:
        result=await generate(DraftRequest(hypothesis='An opening-range breakout with a timed exit'),client,CONFIG)
    assert result['sources']==[] and result['proposal']['evidence']==[]
    assert result['research']['status']=='no_relevant_sources'
    assert not result['proposal']['supported']
