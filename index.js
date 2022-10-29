//DEPENDENCIES
const dotenv = require('dotenv');
const express = require('express');
const app = express();
const puppeteer = require('puppeteer');

dotenv.config();

//GLOBALS
const PORT = process.env.PORT || 8080;
const { BCN_USER, BCN_PSWD } = process.env;
// const BROWSER = await puppeteer.launch();

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`)
});

app.get('/test', (req, res) => {
    res.status(200).send({
        print: BCN_USER,
    });
});
