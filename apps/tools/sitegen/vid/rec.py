# usage: python rec.py <key> [--shots]   — ゲームの Web 版を Playwright WebKit で動かして録画し、H.264 MP4 とポスターを作る
import sys, os, time, json, glob, shutil, subprocess
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scenes import SCENES
FF = os.path.expanduser('~/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac')
from pre import PRE
key = sys.argv[1]; shots = '--shots' in sys.argv
S = SCENES[key]
out = f'{HERE}/out/{key}'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
with sync_playwright() as p:
    b = p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        record_video_dir=out, record_video_size={'width': 390, 'height': 844}, locale='ja-JP', timezone_id='Asia/Tokyo')
    ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file://') or r.request.url.startswith('data:') or r.request.url.startswith('blob:') else r.abort())
    if S.get('init'): ctx.add_init_script(S['init'])
    t0 = time.time()
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.expanduser(f'~/Developer/apps/{S["dir"]}/index.html'))
    pg.wait_for_timeout(S.get('load', 1200))
    if S.get('pysetup'): exec(S['pysetup'], {'pg': pg})
    if S.get('setup'): print('setup', pg.evaluate('async () => { ' + PRE + S['setup'] + ' }'))
    pg.wait_for_timeout(300)
    if shots: pg.screenshot(path=f'{out}/a_setup.png')
    t1 = time.time()
    if S.get('py'): exec(S['py'], {'pg': pg, 'math': __import__('math')}); marks = {}
    else: marks = pg.evaluate('async () => { ' + PRE + ' const marks = {}; const shot = n => { marks[n] = performance.now(); }; ' + S['play'] + '; return marks; }')
    pg.wait_for_timeout(S.get('tail', 1500))
    if shots: pg.screenshot(path=f'{out}/b_end.png')
    t2 = time.time()
    vpath = pg.video.path()
    ctx.close(); b.close()
print('errors', errs[:3])
fr = f'{out}/fr'; os.makedirs(fr)
subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-i', vpath, f'{fr}/%04d.png'], check=True)
n = len(os.listdir(fr))
first = max(1, int((t1 - t0) * 25) + 1 + S.get('skip', 0)); last = min(n, int((t2 - t0) * 25))
if S.get('maxsec'): last = min(last, first + S['maxsec'] * 25)
poster = S.get('poster', 0.85)
pf = first + int((last - first) * poster)
os.makedirs(f'{HERE}/final', exist_ok=True)
r = subprocess.run([f'{HERE}/enc', fr, f'{HERE}/final/{key}.mp4', '25', str(first), str(last), str(S.get('bitrate', 700000)), f'{HERE}/final/{key}.jpg', str(pf), '390'], capture_output=True, text=True)
print(r.stdout.strip(), r.stderr.strip()[-300:])
print('frames', n, 'used', first, last, 'sec', (last - first) / 25, 'size', os.path.getsize(f'{HERE}/final/{key}.mp4'), os.path.getsize(f'{HERE}/final/{key}.jpg'))
shutil.copy(f'{fr}/{pf:04d}.png', f'{HERE}/final/{key}_poster_check.png')
