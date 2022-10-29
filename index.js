const express = require('express');
const app = express();
const PORT = 8080;

app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}.`)
});

app.get('/test', (req, res) => {
    res.status(200).send({
        name: 'ok',
        cool: 'dsds',
    });
});
