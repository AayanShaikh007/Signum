"""Build a small public replay from Cam Nugent's CC0 Kaggle dataset, version 4."""
import csv
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

URL='https://www.kaggle.com/api/v1/datasets/download/camnugent/sandp500?datasetVersionNumber=4'
ROOT=Path(__file__).resolve().parents[1]

def main():
    with urllib.request.urlopen(URL,timeout=60) as response: payload=response.read()
    names={'AAPL':'Apple','NVDA':'Nvidia','MSFT':'Microsoft'}
    rows={symbol:[] for symbol in names}
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        with archive.open('all_stocks_5yr.csv') as file:
            for row in csv.DictReader(io.TextIOWrapper(file,encoding='utf-8')):
                symbol=row['Name']
                if symbol in names and row['date'].startswith('2017-'):
                    price=float(row['close'])
                    if price<=0:raise ValueError('Invalid close')
                    rows[symbol].append({'timestamp':row['date']+'T00:00:00Z','price':price,'quantity':20})
    data={'source':'Cam Nugent / S&P 500 stock data, version 4',
          'source_url':'https://www.kaggle.com/datasets/camnugent/sandp500',
          'download_url':URL,'license':'CC0: Public Domain','archive_sha256':hashlib.sha256(payload).hexdigest(),
          'interval':'1 trading day','price_field':'Daily close as supplied; not a total-return series',
          'date_note':'UTC midnight encodes the source date only, not a trade timestamp',
          'stocks':[{'symbol':symbol,'name':names[symbol],'rows':values} for symbol,values in rows.items()]}
    for stock in data['stocks']:
        dates=[row['timestamp'] for row in stock['rows']]
        assert len(dates)>200 and dates==sorted(set(dates))
    output=ROOT/'frontend/src/data/marketHistory.json';output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf-8')
    print([(stock['symbol'],len(stock['rows'])) for stock in data['stocks']])

if __name__=='__main__':main()
