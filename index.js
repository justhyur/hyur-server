//DEPENDENCIES
const dotenv = require('dotenv');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors')
const app = express();
const fs = require('fs');
const moment = require('moment');
const {getBCNAssets, getCAIXAAssets} = require('./cv-banks');
const {PRIME_logIn, PRIME_bookDays, PRIME_acceptBookings, PRIME_getMeetings} = require('./cv-prime');

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { SERVER_TOKEN } = process.env;

//FUNCTIONS
const writeJSONFile = (file, path) => {
    fs.writeFileSync(path, JSON.stringify(file, null, 2), (err) => {
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
app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

app.get('/convert', async (req, res) => {
    const {token, amount, from, to} = req.query;
    
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else{

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        console.log("Browser opened.");

        const page = await browser.newPage();

        const url = `https://www.xe.com/currencyconverter/convert/?Amount=${amount}&From=${from.toUpperCase()}&To=${to.toUpperCase()}`;

        await page.goto(url);

        let result = await page.evaluate(()=>{
            const el = document.querySelector('.faded-digits').parentElement;
            el.childNodes[2].remove();
            return el.innerText;
        })

        res.status(200).send(result);

        await page.close();

        await browser.close();

        console.log("Browser closed.");

    }
});

app.post('/connection', (req, res) => {
    if(req.err){
        console.log("There was a failure in POST /connection", req.err); 
        res.status(200).send(true);
        return;
    }
    const path = `./database/connections/connection-log.${req.body.visitorId}.json`;
    let connectionLog = readJSONFile(path) || [];
    const {headers, ip, body} = req;
    connectionLog = [...connectionLog, {
        headers, 
        ip, 
        fingerPrint: {
            localStorage: body?.localStorage,
            visitorId: body?.visitorId,
            confidence: body?.confidence?.score,
            osCpu: body?.components?.osCpu?.value,
            languages: body?.components?.languages?.value,
            timeZone: body?.components?.timeZone?.value,
            screenResolution: body?.components?.screenResolution?.value,
            vendor: body?.components?.vendor?.value,
            platform: body?.components?.platform?.value,
        }, 
        timeStamp: Date.now(), 
        date: moment(Date.now()).format("DD/MM/YYYY HH:mm:ss"),
    }];
    if(connectionLog.length > 100){
        connectionLog.shift();
    }
    writeJSONFile(connectionLog, path);
    res.status(200).send(true);
});

app.get('/cv-assets/:bank', (req, res) => {
    const {userName, password, token} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else if(!userName || !password){
        res.status(401).send('Username or Password is missing.');
    }else{
        const {bank} = req.params;
        const bankFunction = bank === 'bcn' ? getBCNAssets : getCAIXAAssets;
        bankFunction(userName, password)
        .then(assets => {
            // 
            res.status(200).send(assets);
        })
        .catch(err => {
            res.status(401).send(err.message);
            console.log(err.message);
        })
    }
});

app.get('/cv-prime/book', async (req, res) => {
    const {token, userName, password, branchCode, timeStamp, numDays, numMinutes, acceptBookings} = req.query;
    
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else if(!userName || !password){
        res.status(401).send('Username or Password is missing.');
    }else if(!numDays || numDays <= 0 || numDays > 30){
        res.status(401).send('The number of days has to be between 1 and 30.');
    }else{

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        console.log("Browser opened.");
        const page = await browser.newPage();

        const urlAfterLogin = await PRIME_logIn(page, userName, password);
        if(urlAfterLogin === 'https://coworking.prime.cv/web/login'){
            res.status(401).send('Username or Password invalid.');
        }else{
            console.log(`${userName} logged in.`);
            const bookedDays = await PRIME_bookDays(page, branchCode, timeStamp, numDays, numMinutes);
            if(bookedDays.error){
                res.status(401).send(bookedDays.message);
            }else{
                if(bookedDays > 0 && acceptBookings.toString() === 'true'){
                    const hasAccepted = await PRIME_acceptBookings(page, bookedDays);
                    if(hasAccepted.error){
                        res.status(401).send(hasAccepted.message);
                    }else{
                        res.status(200).send(`${bookedDays} days booked. ${hasAccepted.message}`);
                    }
                }else{
                    res.status(200).send(`${bookedDays} days booked. Those days invitations were not accepted.`)
                }
            }
        }

        await page.close();
        await browser.close();

        console.log("Browser closed.");
    
    }
});

app.get('/cv-prime/accept-invitations', async (req, res) => {
    const {token, userName, password, numBookings} = req.query;
    
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else if(!userName || !password){
        res.status(401).send('Username or Password si missing.');
    }else if(!numBookings || numBookings <= 0){
        res.status(401).send('The number of bookings has to be greater than 0.');
    }else{

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        console.log("Browser opened.");
        const page = await browser.newPage();

        const urlAfterLogin = await PRIME_logIn(page, userName, password);
        if(urlAfterLogin === 'https://coworking.prime.cv/web/login'){
            res.status(401).send('Username or Password is invalid.');
        }else{
            const hasAccepted = await PRIME_acceptBookings(page, numBookings);
            if(hasAccepted.error){
                res.status(401).send(hasAccepted.message);
            }else{
                res.status(200).send(hasAccepted.message);
            }
        }

        await page.close();
        await browser.close();

        console.log("Browser closed.");
    
    }
});

app.get('/cv-prime/meetings', async (req, res) => {
    const {token, userName, password} = req.query;
    
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else if(!userName || !password){
        res.status(401).send('Username or Password is missing.');
    }else{

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        console.log("Browser opened.");
        const page = await browser.newPage();

        const urlAfterLogin = await PRIME_logIn(page, userName, password);
        if(urlAfterLogin === 'https://coworking.prime.cv/web/login'){
            res.status(401).send('Username or Password is invalid.');
        }else{
            console.log(`${userName} logged in.`);
            const meetings = await PRIME_getMeetings(page);
            res.status(200).send(meetings);
        }

        await page.close();
        await browser.close();

        console.log("Browser closed.");
    
    }
});

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`);
});
