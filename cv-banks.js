
const getBCNAssets = async (browser, env) => {
    if(!browser){return null}
    const {BCN_USER, BCN_PSWD} = env;
    const page = await browser.newPage();
    console.log("BCN Page opened.");
    await page.goto('https://particulares.bcn.cv/', {
        waitUntil: 'networkidle0', 
        timeout: 0
    });

    const frameHandle = await page.$("iframe[id=mainFrame]");
    const frame = await frameHandle.contentFrame();

    await frame.evaluate(({BCN_USER, BCN_PSWD}) => {
        document.querySelector("#ctl00_ctl00_Utilizador").value = BCN_USER;
        document.querySelector("#ctl00_ctl00_Password").value = BCN_PSWD;
        document.querySelector("#ctl00_ctl00_SubmitBtn").click();
    }, {BCN_USER, BCN_PSWD});

    await frame.waitForNavigation({waitUntil: 'networkidle0',});
    const assets = await frame.evaluate(() => {
        return document.querySelector("#ctl00_ctl00_Ctrl_CPIN1_GridViewActivos > thead > tr > th.text-right").innerText;
    });

    await page.close();
    console.log("BCN Page closed.");

    return assets;
}

const getCAIXAAssets = async (browser, env) => {
    if(!browser){return null}
    const {CAIXA_USER, CAIXA_PSWD} = env;
    const page = await browser.newPage();
    console.log("CAIXA Page opened.");
    await page.goto('https://caixanet.caixa.cv/', {
        waitUntil: 'networkidle0', 
        timeout: 0
    });
    await page.evaluate(({CAIXA_USER, CAIXA_PSWD}) => {
        document.querySelector("#username").value = CAIXA_USER;
        document.querySelector("#password").value = CAIXA_PSWD;
        document.querySelector("#login-form > div > div.col-lg-12.col-lg-offset-3 > div.row.mt-3.pt-1.justify-content-between > div.col-12.col-sm-6.order-0.order-sm-1 > button").click();
    }, {CAIXA_USER, CAIXA_PSWD});

    await page.waitForNavigation({waitUntil: 'networkidle0',});
    const assets = await page.evaluate(() => {
        return document.querySelector("#master-col > div > div > div:nth-child(1) > div > div > div.mb-4.pt-3.pb-4.border-bottom > div.col.text-right > span").innerText;
    });

    await page.close();
    console.log("CAIXA Page closed.");

    return assets;
}

module.exports = {getBCNAssets, getCAIXAAssets};