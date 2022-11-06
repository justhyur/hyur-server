const puppeteer = require('puppeteer');
const moment = require('moment');

const format = (value, currency) => {
    let stringValue = value.toString();
    let isNegative;
    if(stringValue[0] === '-' || stringValue[0] === '+'){
        if(stringValue[0] === '-') {isNegative = true;}
        stringValue = stringValue.substr(1, stringValue.length);
    }
    let decimals = stringValue.split('.')[1] || '00';
    if(decimals.length < 2){
        while(decimals.length < 2){
            decimals += '0';
        }
    }
    const integers =  stringValue.split('.')[0];
    let newString = '';
    for(let i=0; i<integers.length; i++){
        const check = integers.length - 1 - i;
        newString = integers[check] + newString;
        if( (i+1)%3 === 0 && integers[check - 1] ){
        newString = ',' + newString;
        }
    }
    return `${isNegative? '-' : '+'}${newString}${decimals ? '.'+decimals : ''} ${currency}`;
}

const deFormat = (formatted) => {
    const splitted = formatted.replaceAll('.','').replaceAll(',','').split(' ');
    const value = Number(splitted[0])/100;
    const currency = splitted[1];
    return {formatted: format(value, currency), value, currency}
}

const getBCNAssets = async (userName, password) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    console.log("BCN: logging in...");
    await page.goto('https://particulares.bcn.cv/', {waitUntil: 'networkidle0', timeout: 0});

    const frameHandle = await page.$("iframe[id=mainFrame]");
    const frame = await frameHandle.contentFrame();

    await frame.evaluate(()=>{
        document.querySelector("#IB-login > div.IB-header-screen > div.IB-header-page.IB-page.container-fluid > div > div.col-xs-9 > div.IB-header-menu > div.IB-lang > a").click();
    });

    await frame.waitForNavigation({waitUntil: 'networkidle0',});

    await frame.evaluate(({userName, password}) => {
        document.querySelector("#ctl00_ctl00_Utilizador").value = userName;
        document.querySelector("#ctl00_ctl00_Password").value = password;
        document.querySelector("#ctl00_ctl00_SubmitBtn").click();
    }, {userName, password});

    await frame.waitForNavigation({waitUntil: 'networkidle0',});

    const isLoggedIn = await frame.evaluate(() => {
        const errorText = document.querySelector("#ctl00_ctl00_ErrorText");
        return errorText ? {error: errorText.innerText} : {success: true};
    });
    if(isLoggedIn.error){
        throw new Error(isLoggedIn.error);
    }

    console.log("BCN: logged in.");
    
    const transactionURL = await frame.evaluate(() => {
        return document.querySelector("#bs-example-navbar-collapse-1 > ul > li:nth-child(3) > ul > li:nth-child(9) > a").href;
    });

    await frame.goto(transactionURL, {waitUntil: 'networkidle0', timeout: 0});

    const assets = await frame.evaluate( () => {

        const accountNumber = document.querySelector("#ctl00_ctl00_WP_CMOV_drpDnLstAccounts").value;
        const accounting = document.querySelector("#balance1").innerText;
        const available = document.querySelector("#balance2").innerText;
        const movements = [];
        const tbody = document.querySelector("#ctl00_ctl00_WP_CMOV_grdCMOV > tbody");
        [].slice.call(tbody.children).forEach( (tr, r) => {
            movements[r] = {};
            [].slice.call(tr.children).forEach( td => {
                const dataTitle = td.getAttribute("data-title");
                const key = dataTitle === 'Value date'? 'date' :
                            dataTitle === 'Description'? 'description' :
                            dataTitle === 'Value'? 'amount' : null;
                if(key){
                    const value = td.children[0] ? td.children[0].innerText : td.innerText;
                    movements[r][key] = value;
                }
            });
        });
        return {date: Date.now(), accountNumber, accounting, available, movements};
    });

    assets.accounting = deFormat(assets.accounting);
    assets.available = deFormat(assets.available);
    assets.movements.forEach(m => {
        m.amount = deFormat(m.amount)
    });

    await browser.close();
    console.log("BCN Page closed.");

    return assets;
}

const getCAIXAAssets = async (userName, password) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    console.log("CAIXA: logging in...");
    await page.goto('https://caixanet.caixa.cv/?l=en', {
        waitUntil: 'networkidle0', 
        timeout: 0
    });
    await page.evaluate(({userName, password}) => {
        document.querySelector("#username").value = userName;
        document.querySelector("#password").value = password;
        document.querySelector("#login-form > div > div.col-lg-12.col-lg-offset-3 > div.row.mt-3.pt-1.justify-content-between > div.col-12.col-sm-6.order-0.order-sm-1 > button").click();
    }, {userName, password});

    await page.waitForNavigation({waitUntil: 'networkidle0',});

    const isLoggedIn = await page.evaluate(() => {
        const errorText = document.querySelector("#toast1 > div > strong");
        return errorText ? {error: errorText.innerText} : {success: true};
    });
    if(isLoggedIn.error){
        throw new Error(isLoggedIn.error);
    }

    console.log("CAIXA: logged in.");

    await page.goto('https://caixanet.caixa.cv/current-accounts', {waitUntil: 'networkidle0', timeout: 0});

    const assets = await page.evaluate(() => {
        
        const accountNumber = document.querySelector("#master-col > div > div > div:nth-child(1) > div > div > div > div.list-item.shadow.bg-primary.px-4.py-3.active-account > div.row > div.col-12.col-lg-3.pt-3.account-number > span").innerText;
        const accounting = document.querySelector("#master-col > div > div > div.col-12.my-2.js--account-details-info > div > div > div > div.row.font-size-xs.pt-2 > div.col-12.col-xl-8 > div > div.col-12.col-sm-6.order-7 > div > div.col.text-right.text-primary > span").innerText;
        const available = document.querySelector("#master-col > div > div > div.col-12.my-2.js--account-details-info > div > div > div > div.row.font-size-xs.pt-2 > div.col-12.col-xl-8 > div > div.col-12.col-sm-6.order-8.order-sm-9 > div > div.col.text-right.text-primary > span").innerText;
        const movements = [];
        const tbody = document.querySelector("#master-col > div > div > div:nth-child(4) > div > div > div > div.row.flex-grow-1 > div > div");
        [].slice.call(tbody.children).forEach( (el, r) => {
            const tr = el.children[0].children[0];
            movements[r] = {};
            [].slice.call(tr.children).forEach( (td, c) => {
                if(c === 0){return;}
                const key = c === 1 ? 'date' :
                            c === 2 ? 'description' :
                            c === 3 ? 'amount' : null;
                if(key){
                    const value = td.children[0].innerText;
                    movements[r][key] = value;
                }
            });
        });
        return {date: Date.now(), accountNumber, accounting, available, movements};
    });
    assets.accounting = deFormat(assets.accounting);
    assets.available = deFormat(assets.available);
    assets.movements.forEach(m => {
        m.date = moment(m.date, "DD-MM-YYYY").format("DD/MM/YYYY");
        m.amount = deFormat(m.amount)
    });

    await browser.close();
    console.log("CAIXA Page closed.");

    return assets;
}

module.exports = {getBCNAssets, getCAIXAAssets};