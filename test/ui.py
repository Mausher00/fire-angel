import asyncio, re
from playwright.async_api import async_playwright
B='http://127.0.0.1:8787/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errs=[]
        z = await (await b.new_context(viewport={'width':1366,'height':900})).new_page()
        z.on('pageerror', lambda e: errs.append('Z '+str(e)))
        await z.goto(B+'#juego'); await z.wait_for_timeout(800)
        await z.fill('[data-registro] [name=codigo]','prueba-arranque'); await z.fill('[data-registro] [name=nombre]','Zalo'); await z.fill('[data-registro] [name=clave]','clave-zalo-1')
        await z.click('[data-registro] button'); await z.wait_for_timeout(800)
        await z.fill('#ncamp','Carga frágil'); await z.click('[data-nuevacamp] button'); await z.wait_for_timeout(900)
        await z.click('[data-ctab=ajustes]'); await z.wait_for_timeout(300)
        await z.fill('[data-aj] [name=cambio]','2.5'); await z.click('[data-aj] button[type=submit]'); await z.wait_for_timeout(500)
        await z.click('[data-ctab=ajustes]'); await z.click('[data-inv] button'); await z.wait_for_timeout(500)
        url = re.search(r'http\S+#juego/inv-\w+', await z.inner_text('[data-invres]')).group(0)
        print('invitación', url)
        await z.screenshot(path='test/p1.png')
        a = await (await b.new_context(viewport={'width':1366,'height':900})).new_page()
        a.on('pageerror', lambda e: errs.append('A '+str(e)))
        pj={"name":"Kara Vosk","cls":"mercenarios","concept":"Mercenaria endeudada","shift":{"fue":1,"con":1,"per":0},"gen":{"disparo":6,"atletismo":4,"combate-con-armas":4,"buscar":3,"vista":3},"adq":{},"donGen":"","donCls":"","inv":[{"n":"Fusil de asalto","t":"w","p":400,"info":"","q":1},{"n":"Armadura de infantería","t":"a","p":200,"info":"","q":1}],"step":7}
        await a.goto(B+'#inicio'); await a.evaluate("j=>localStorage.setItem('fa-pj',JSON.stringify(j))", pj)
        await a.goto(url); await a.reload(); await a.wait_for_timeout(900)
        await a.fill('[data-registro] [name=nombre]','Ana'); await a.fill('[data-registro] [name=clave]','clave-ana-1'); await a.click('[data-registro] button'); await a.wait_for_timeout(900)
        await a.click('[data-subir]'); await a.wait_for_timeout(1000)
        await a.screenshot(path='test/p2.png', full_page=True)
        await a.click('[data-ptab=equipo]'); await a.wait_for_timeout(300)
        await a.select_option('[data-tt]','todo'); await a.wait_for_timeout(200); await a.fill('[data-tq]','mochila'); await a.wait_for_timeout(300)
        await a.click('[data-compra="0"]'); await a.wait_for_timeout(600)
        await a.screenshot(path='test/p3.png', full_page=True)
        pid = re.search(r'pj-(\w+)', a.url).group(1)
        await a.goto(B+'#juego'); await a.wait_for_timeout(600)
        await a.click('.pcc'); await a.wait_for_timeout(800); await a.click('[data-ctab=grupo]'); await a.wait_for_timeout(300)
        await a.select_option('[data-elige] select', pid); await a.click('[data-elige] button'); await a.wait_for_timeout(900)
        # Zalo recompensa
        await z.reload(); await z.wait_for_timeout(900); await z.click('[data-ctab=grupo]'); await z.wait_for_timeout(300)
        await z.fill('[data-recomp] [name=px]','15'); await z.fill('[data-recomp] [name=motivo]','Sesión 1'); await z.click('[data-recomp] button[type=submit]'); await z.wait_for_timeout(700)
        # Ana gasta PX
        await a.goto(B+'#juego/pj-'+pid); await a.wait_for_timeout(900); await a.click('[data-ptab=px]'); await a.wait_for_timeout(300)
        await a.click('[data-hito="hab"]'); await a.wait_for_timeout(700)
        btn = await a.query_selector('[data-sube="hab"]:not([disabled])')
        if btn: await btn.click(); await a.wait_for_timeout(700)
        await a.screenshot(path='test/p4.png', full_page=True)
        # Cambio de moneda
        await a.click('[data-ptab=equipo]'); await a.wait_for_timeout(300)
        await a.fill('[data-cambio] [name=cant]','100'); await a.click('[data-cambio] button'); await a.wait_for_timeout(700)
        din = await a.evaluate("()=>[...document.querySelectorAll('[data-din]')].map(i=>i.value)")
        print('dinero tras cambio', din)
        # Mesa
        await a.goto(B+'#juego'); await a.wait_for_timeout(500); await a.click('.pcc'); await a.wait_for_timeout(800); await a.click('[data-ctab=mesa]'); await a.wait_for_timeout(1500)
        await z.click('[data-ctab=mesa]'); await z.wait_for_timeout(1500)
        await a.click('[data-tira] button[type=submit]'); await a.wait_for_timeout(400)
        await a.fill('#mChat','¡Hola, mesa!'); await a.click('[data-chat] button'); await a.wait_for_timeout(400)
        await z.check('[data-tira] [name=secreta]'); await z.click('[data-tira] button[type=submit]'); await z.wait_for_timeout(400)
        await z.click('.pmas summary'); await z.fill('[data-aviso] [name=titulo]','Llegáis al Astillero 15'); await z.fill('[data-aviso] [name=txt]','La niebla del río lo cubre todo.'); await z.click('[data-aviso] button'); await z.wait_for_timeout(700)
        la = await a.inner_text('#mLog'); lz = await z.inner_text('#mLog')
        print('ANA:\n'+la); print('ZALO:\n'+lz)
        assert 'secreta' not in la
        await a.screenshot(path='test/p5.png'); await z.screenshot(path='test/p6.png')
        # nota visible
        await z.click('[data-ctab=notas]'); await z.wait_for_timeout(400); await z.click('[data-nueva]'); await z.fill('[data-nota] [name=titulo]','Secreto del cliente'); await z.fill('[data-nota] [name=cuerpo]','**El cliente** miente.'); await z.click('[data-nota] button[type=submit]'); await z.wait_for_timeout(600)
        await a.click('[data-ctab=notas]'); await a.wait_for_timeout(500); print('notas Ana:', (await a.inner_text('#cPanel'))[:80])
        # móvil
        m = await (await b.new_context(viewport={'width':390,'height':844})).new_page(); await m.goto(B+'#juego'); await m.wait_for_timeout(600); await m.screenshot(path='test/p7.png')
        print('ERRORES', errs)
        await b.close()
asyncio.run(main())
