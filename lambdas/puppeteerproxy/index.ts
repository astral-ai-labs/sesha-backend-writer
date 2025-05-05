import puppeteer from "puppeteer-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import * as proxyChain from 'proxy-chain';
import chromium from "@sparticuz/chromium-min";

export const handler = async (event: any, context: any) => {
  console.log(`event received : ${JSON.stringify(event)}`)
  try {
    puppeteer.use(StealthPlugin());
    const { body } = event
    if ( !body ) throw new Error("error : missing body in request")
    if ( body ) {
      const { url } = body
      if ( !url ) throw new Error("error : missing url in request body")
      if ( url ) {
        console.log(`🤿 creating anonymized proxy...`)
        const proxy = `http://${process.env.proxyNetworkUsername}:${process.env.proxyNetworkPassword}@${process.env.proxyNetworkServer}`;
        const anonymizedProxy = await proxyChain.anonymizeProxy(proxy);
        console.log(`🌍 launching chromium browser...`)
        const browser = await puppeteer.launch({
          executablePath: await chromium.executablePath("/opt/nodejs/node_modules/@sparticuz/chromium/bin"),
          ignoreHTTPSErrors: true,
          headless: true,
          waitForInitialPage:false,
          defaultViewport: { width: 1920, height: 1080 },
          args: [
            `--proxy-server=${anonymizedProxy}`,
            '--disable-gpu',
            '--disable-gpu-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--disable-software-rasterizer',
            '--disable-seccomp-filter-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--deterministic-fetch',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
            '--no-startup-window',
            '--single-process',
          ],
        });
        console.log(`🌍 chromium browser launched...`)
        await new Promise((resolve) => setTimeout(() => resolve(true),1000))
        console.log(`📄 creating new page...`)
        const page = await browser.newPage();
        console.log(`📄 page created...`)
        await page.setRequestInterception(true);
        let intImagesIntercepted = 0
        page.on('request', (req:any) => {
            if(req.resourceType() === 'image'){
              intImagesIntercepted+=1;
              req.abort();
            }
            else {
                req.continue();
            }
        });
        console.log(`🧭 navigating to url : `, url)
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        try {
          await page.goto(url, { waitUntil: ['load', 'domcontentloaded'], timeout: 20000 });
        } catch(e) {
          console.error("page navigation error")
          console.trace(e)
        }
        const pageContent = await page.content()
        console.log(`🖼️ Number of Images Intercepted : ${intImagesIntercepted}`)
        const pageContentStringified = JSON.stringify({pageContent})
        console.log(`Page Content : `, pageContentStringified)
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: pageContentStringified,
        }
      }
    }
  } catch(e) {
    console.error("unexpected error encountered")
    console.trace(e)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: `${e}` }),
    }
  }
}