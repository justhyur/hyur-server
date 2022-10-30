//DEPENDENCIES
const dotenv = require('dotenv');
const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { BCN_USER, BCN_PSWD, SERVER_TOKEN } = process.env;
let BCN_ASSETS;

//FUNCTIONS
const getBCNAssets = async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    console.log("Opening browser...");
    const page = await browser.newPage();
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
    await browser.close();
    console.log("Browser closed.");
    return assets;
}

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`)
});

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

app.get('/bcn-assets', (req, res) => {
    const {token} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token not valid.');
    }
    res.status(200).send(BCN_ASSETS);
});

//RUNTIME
const runtime = async (seconds) => {
    const milliseconds = seconds * 1000;
    console.log('Runtiming...');
    setTimeout(()=>{
        runtime(milliseconds);
    }, milliseconds);
    BCN_ASSETS = await getBCNAssets();
}
runtime(5 * 60);
