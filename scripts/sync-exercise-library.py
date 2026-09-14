"""Refresh the public-domain catalog and locally hosted mobility photographs."""
import concurrent.futures
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/'

def read(url):
    with urlopen(url, timeout=45) as response:
        return response.read()

if __name__ == '__main__':
    revision = json.loads(read('https://api.github.com/repos/yuhonas/free-exercise-db/commits/main'))['sha']
    records = json.loads(read(f'{REPOSITORY}{revision}/dist/exercises.json'))
    (ROOT / 'public/data').mkdir(parents=True, exist_ok=True)
    (ROOT / 'public/data/exercises.json').write_text(json.dumps(records, separators=(',', ':')) + '\n')
    paths = [image for record in records if record['category'] == 'stretching' for image in record['images']]
    def download(path):
        target = ROOT / 'public/exercises/library' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(read(f'{REPOSITORY}{revision}/exercises/{path}'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(download, paths))
    (ROOT / 'public/data/exercise-source.json').write_text(json.dumps({
        'project': 'https://github.com/yuhonas/free-exercise-db',
        'revision': revision, 'license': 'Unlicense',
        'records': len(records), 'localImages': len(paths),
    }, indent=2) + '\n')
    (ROOT / 'public/data/EXERCISE-LICENSE.txt').write_bytes(read(f'{REPOSITORY}{revision}/LICENSE.md'))
    print(f'Saved {len(records)} records and {len(paths)} photographs from {revision}')
