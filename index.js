//DEPENDENCIES
const dotenv = require('dotenv');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors')
const app = express();
const fs = require('fs');
const moment = require('moment');
const dirTree = require("directory-tree");
const {getBCNAssets, getCAIXAAssets} = require('./cv-banks');
const {PRIME_logIn, PRIME_bookDays, PRIME_acceptBookings, PRIME_getMeetings} = require('./cv-prime');

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { SERVER_TOKEN, ALLOW_LOCALHOST } = process.env;

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
const origin = [
    'https://cv-helper.vercel.app', 
    'https://cv-helper-app.vercel.app', 
    'https://cv-connections-viewer.vercel.app', 
    'https://sendor.llc', 
]
if(ALLOW_LOCALHOST){origin.push('http://localhost:3000')}

if(!fs.existsSync('./jdatabase')){
    fs.mkdirSync('./jdatabase');
}
if(!fs.existsSync('./jdatabase/connections')){
    fs.mkdirSync('./jdatabase/connections');
}

app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

const conversionRates = readJSONFile('./jdatabase/conversion-rate.json') || {};
app.get('/convert', async (req, res) => {
    const {token, amount, from, to} = req.query;
    
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else{

        const rate = conversionRates[from+to] ?? conversionRates[to+from];
        if(rate && (Date.now() - rate.date) / 1000 / 60 < 10 ){
            res.status(200).send(rate.from === from ? rate.result : (1/Number(rate.result)).toString());
            return;
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        console.log("Browser opened.");

        const page = await browser.newPage();

        const url = `https://www.xe.com/currencyconverter/convert/?Amount=${amount}&From=${from.toUpperCase()}&To=${to.toUpperCase()}`;

        await page.goto(url, {waitUntil: 'load', timeout: 0});

        let result = await page.evaluate(()=>{
            const el = document.querySelector('.faded-digits').parentElement;
            el.childNodes[2].remove();
            return el.innerText;
        });

        conversionRates[from+to] = {
            date: Date.now(),
            from, to,
            result
        }
        writeJSONFile(conversionRates, './jdatabase/conversion-rate.json');

        res.status(200).send(result);

        await page.close();

        await browser.close();

        console.log("Browser closed.");

    }
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
        try{
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
        catch(err){
            res.status(500).send("Server error");
            console.error(err);
        }
    }
});

app.get('/cv-prime/book', async (req, res) => {
    const {token, userName, password, branchCode, timeStamp, numDays, numMinutes, acceptBookings, skipWeekends} = req.query;
    
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
            const bookedDays = await PRIME_bookDays(page, branchCode, timeStamp, numDays, numMinutes, skipWeekends);
            if(bookedDays.error){
                res.status(401).send(bookedDays.message);
            }else{
                if(bookedDays.filter(b=>b.booked).length > 0 && acceptBookings.toString() === 'true'){
                    const hasAccepted = await PRIME_acceptBookings(page, bookedDays.filter(b=>b.booked).length);
                    if(hasAccepted.error){
                        res.status(401).send(hasAccepted.message);
                    }else{
                        let meetings = false;
                        let atLeastOne = false;
                        for(let i=0; i<bookedDays.length; i++){if(bookedDays[i].booked){atLeastOne=true; break;}}
                        if(atLeastOne){
                            meetings = await PRIME_getMeetings(page);
                        }
                        res.status(200).send({bookedDays, meetings});
                    }
                }else{
                    let meetings = false;
                    let atLeastOne = false;
                    for(let i=0; i<bookedDays.length; i++){if(bookedDays[i].booked){atLeastOne=true; break;}}
                    if(atLeastOne){
                        meetings = await PRIME_getMeetings(page);
                    }
                    res.status(200).send({bookedDays, meetings});
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
                const meetings = await PRIME_getMeetings(page);
                res.status(200).send({meetings});
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

app.get('/element-to-pdf', async (req, res) => {
    const {token, htmlContent, fileName} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else{
        try {
    
            // Launch a new browser instance
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox']
            });
        
            // Create a new page in the browser
            const page = await browser.newPage();
        
            // Set the content of the page to the HTML string
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
            // Set the page size to A4
            await page.emulateMediaType('screen');
            await page.setViewport({ width: 595, height: 842 });
        
            // Generate the PDF
            const pdf = await page.pdf({ format: 'A4', printBackground: true });
        
            // Close the browser
            await browser.close();
        
            // Set the response headers and return the PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}.pdf`);
            res.send(pdf);
          } catch (error) {
            console.error('Error generating PDF:', error);
            res.status(500).json({ error: 'Error generating PDF' });
          }
    }
})

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`);
});
