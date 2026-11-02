"""Native sample UI regression. Run the built sample app, then set VITRINA_BASE_URL.
Requires Playwright Python + Chromium. Provider origins are blocked by this test.
"""
import asyncio,json,pathlib,os,tempfile
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
OUT=pathlib.Path(os.environ.get('VITRINA_PROOF_DIR',tempfile.mkdtemp(prefix='vitrina-ux-')));OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('VITRINA_BASE_URL','http://127.0.0.1:5173/')
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM'),args=['--no-sandbox']);rows=[]
  for w in [320,390,768,1600]:
   page=await browser.new_page(viewport={'width':w,'height':900 if w>=768 else 844},has_touch=w<768,is_mobile=w<768);errors=[];external=[];checks={};page.on('pageerror',lambda e:errors.append(str(e)))
   async def fence(route):
    if not route.request.url.startswith(('data:','blob:')) and urlsplit(route.request.url).netloc != urlsplit(BASE).netloc:external.append(route.request.url);await route.abort()
    else:await route.continue_()
   await page.route('**/*',fence)
   def check(name,value):
    checks[name]=bool(value)
    if not value:raise AssertionError(name)
   async def modal(selector):
    return await page.locator(selector).evaluate('(e)=>{let r=e.getBoundingClientRect();return e.matches(":modal")&&Math.abs(r.x)<1&&Math.abs(r.y)<1&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1}')
   try:
    await page.goto(BASE,wait_until='domcontentloaded');await page.wait_for_timeout(250)
    geom=await page.evaluate('''()=>{let m=document.querySelector('.vitrina-app-main').getBoundingClientRect(),s=document.querySelector('.vitrina-side-nav').getBoundingClientRect();return{main:{x:m.x,w:m.width},side:{x:s.x,w:s.width},overflow:document.documentElement.scrollWidth-innerWidth}}''')
    check('feed_receives_main_column',geom['main']['w']>=min(w-40,600));check('desktop_navigation_leads_feed',w<1024 or geom['side']['x']<geom['main']['x']);check('no_overflow',geom['overflow']==0)
    await page.screenshot(path=str(OUT/f'vitrina-{w}-fixed.png'))
    card=page.get_by_role('button').filter(has_text='Tomato pasta').first;await card.click();await page.wait_for_selector('dialog.vitrina-recipe-modal:modal');check('recipe_fullscreen_native_modal',await modal('.vitrina-recipe-modal'));check('recipe_named',await page.get_by_role('dialog',name='Tomato pasta',exact=True).count()==1);check('poster_visible',await page.locator('.vitrina-recipe-embed__poster img').evaluate('e=>{let r=e.getBoundingClientRect();return e.naturalWidth>0&&r.height>100&&r.width>100}'));check('recipe_focus_inside',await page.locator('.vitrina-recipe-modal').evaluate('e=>e.contains(document.activeElement)'))
    await page.keyboard.press('Shift+Tab');check('recipe_tab_contained',await page.locator('.vitrina-recipe-modal').evaluate('e=>e.contains(document.activeElement)'));await page.keyboard.press('Escape');await page.wait_for_selector('.vitrina-recipe-modal',state='detached');check('recipe_focus_restored',await card.evaluate('e=>e===document.activeElement'))
    await card.click();await page.locator('.vitrina-recipe-modal').get_by_role('button',name='Increase',exact=True).click();check('portions_update_total','€12.20' in await page.locator('.vitrina-recipe-total').inner_text());await page.screenshot(path=str(OUT/f'vitrina-{w}-recipe.png'))
    await page.get_by_role('button',name='Add to Basket',exact=True).click();await page.wait_for_selector('.vitrina-basket-sheet:modal');check('basket_fullscreen_native_modal',await modal('.vitrina-basket-sheet'));check('basket_named',await page.get_by_role('dialog',name='Your basket',exact=True).count()==1);basket_text=await page.locator('.vitrina-basket-panel').inner_text();check('basket_has_both_shops',all(s in basket_text for s in ['Garden Market','Corner Pantry']));check('basket_quantity_targets_44',await page.locator('.vitrina-basket-panel .vitrina-stepper__btn').evaluate_all('es=>es.every(e=>{let r=e.getBoundingClientRect();return r.width>=44&&r.height>=44})'));check('basket_panel_no_overflow',await page.locator('.vitrina-basket-panel').evaluate('e=>e.scrollWidth<=e.clientWidth'));await page.screenshot(path=str(OUT/f'vitrina-{w}-basket.png'))
    await page.get_by_role('button',name='Clear basket',exact=True).click();await page.wait_for_selector('.vitrina-clear-confirm:modal');check('nested_confirm_named',await page.get_by_role('dialog',name='Clear this basket?',exact=True).count()==1);check('nested_focus_inside',await page.locator('.vitrina-clear-confirm').evaluate('e=>e.contains(document.activeElement)'));await page.keyboard.press('Escape');await page.wait_for_selector('.vitrina-clear-confirm',state='detached');check('escape_keeps_parent_open',await page.locator('.vitrina-basket-sheet').evaluate('e=>e.matches(":modal")'));check('escape_restores_parent_focus',await page.get_by_role('button',name='Clear basket',exact=True).evaluate('e=>e===document.activeElement'));await page.screenshot(path=str(OUT/f'vitrina-{w}-basket-after-confirm.png'))
    await page.keyboard.press('Escape');await page.wait_for_selector('.vitrina-basket-sheet',state='detached');check('basket_returns_to_origin',await card.evaluate('e=>e===document.activeElement') or await page.get_by_role('button',name='Open basket',exact=True).evaluate('e=>e===document.activeElement'));check('scroll_lock_released',await page.locator('#root').evaluate('e=>e.style.overflow!=="hidden"'))
    await page.get_by_role('button',name='Open basket',exact=True).click();await page.get_by_text('Garden Market',exact=True).first.wait_for();basket_text=await page.locator('.vitrina-basket-panel').inner_text();check('basket_persists',all(s in basket_text for s in ['Garden Market','Corner Pantry']));await page.get_by_role('button',name='Close basket',exact=True).click();await page.wait_for_selector('.vitrina-basket-sheet',state='detached');await page.reload(wait_until='domcontentloaded');await page.get_by_role('button',name='Open basket',exact=True).click();await page.get_by_text('Garden Market',exact=True).first.wait_for();check('basket_survives_reload',await page.get_by_text('Corner Pantry',exact=True).count()==1);await page.get_by_role('button',name='Close basket',exact=True).click();check('header_basket_focus_restored',await page.get_by_role('button',name='Open basket',exact=True).evaluate('e=>e===document.activeElement'));check('no_page_errors',not errors)
    rows.append({'width':w,'checks':checks,'geometry':geom,'errors':errors,'blocked_external':external,'passed':True})
   except Exception as e:
    rows.append({'width':w,'checks':checks,'error':str(e),'errors':errors,'blocked_external':external,'body':(await page.locator('body').inner_text())[-2000:]});await page.screenshot(path=str(OUT/f'vitrina-{w}-regression-error.png'))
   (OUT/'vitrina-regression.json').write_text(json.dumps({'base':BASE,'cases':rows},indent=2));await page.close()
  await browser.close()
 print(json.dumps({'base':BASE,'cases':[{k:v for k,v in r.items()if k!='body'}for r in rows]},indent=2));assert all(r.get('passed')for r in rows)
asyncio.run(main())
