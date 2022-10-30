//DEPENDENCIES
const dotenv = require('dotenv');
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const app = express();
const {getBCNAssets, getCAIXAAssets} = require('./cv-banks');

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
app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
    res.status(200).send('API is online.');
});

app.get('/cv-assets/:bank', (req, res) => {
    const {userName, password, token} = req.query;
    if(token !== SERVER_TOKEN){
        res.status(401).send('Token is missing or not valid.');
    }else{
        const {bank} = req.params;
        const bankFunction = bank === 'bcn' ? getBCNAssets : getCAIXAAssets;
        bankFunction(userName, password)
        .then(assets => {
            res.status(200).send(assets);
        })
        .catch(err => {
            console.log(err);
        })
    }
});

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`);
});

//RUNTIME
const runtime = (minutes) => {
    const milliseconds = minutes * 60 * 1000;
    console.log('Runtiming...');
    setTimeout(()=>{
        runtime(milliseconds);
    }, milliseconds);
}
