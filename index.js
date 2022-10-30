//DEPENDENCIES
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');
const app = express();
const {getBCNAssets, getCAIXAAssets} = require('./cv-banks');
const puppeteer = require('puppeteer');
let BROWSER;

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { SERVER_TOKEN } = process.env;

//FUNCTIONS
const writeJSONFile = (file, path) => {
    fs.writeFileSync(path, JSON.stringify(file), (err) => {
        if(err){console.error(err);}
    });
}
const readJSONFile = (path) => {
    if(!fs.existsSync(path)){return null}
    const file = fs.readFileSync(path, (err)=>{
        if(err){console.error(err)}
    });
    return JSON.parse(file);
}

//API
app.use(express.json());

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

app.get('/cv-assets/:bank', (req, res) => {
    const {token} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }
    const {bank} = req.params;
    const assets = readJSONFile(`./database/${bank}_assets.json`);
    res.status(200).send(assets);
});

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`)
});

//RUNTIME
const runtime = (minutes) => {
    const milliseconds = minutes * 60 * 1000;
    console.log('Runtiming...');
    setTimeout(()=>{
        runtime(milliseconds);
    }, milliseconds);
    //BCN
    getBCNAssets(BROWSER, process.env).then(bcnAssets => {
        writeJSONFile(bcnAssets, './database/bcn_assets.json');
    });
    //CAIXA
    getCAIXAAssets(BROWSER, process.env).then(caixaAssets => {
        writeJSONFile(caixaAssets, './database/caixa_assets.json');
    });
}

puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
}).then(res => {
    BROWSER = res;
    runtime(process.env.RUNTIME_MINUTES);
});
