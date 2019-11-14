/* Read .env config file. */
require('dotenv').config();

const fs = require('fs');
const puppeteer = require('puppeteer');
const superagent = require('superagent');

async function queryStockPrice(asset) {
    if (!asset) {
        throw new Error("No valid asset");
    }

    let url = `https://mis.twse.com.tw/stock/fibest.jsp?stock=${asset}`;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url);
    } catch (err) {
        throw err;
    }

    const priceElem = await page.$(`#fibestrow > td`);
    const price = await page.evaluate(function (elem) {
        return elem.textContent;
    }, priceElem);

    await browser.close();

    return price;
}

async function sendMail(subject, text) {
    superagent
        .post(`https://api.mailgun.net/v3/${process.env['MAILGUN_DOMAIN']}/messages`)
        .auth('api', `${process.env['MAILGUN_KEY']}`)
        .type('form')
        .send({
            "from": `Price Notify <notify@${process.env['MAILGUN_DOMAIN']}>`,
            "to": [`${process.env['INVESTOR']}`],
            "subject": subject,
            "text": text
        })
        .catch(function (err) {
            console.log(err);
        });
}

/* Main function. */
(async function () {
    /* Get config path. */
    let args = process.argv;

    if (args.length < 3) {
        throw new Error('No valid config');
    }

    const config = args[2];

    /* Read config file. */
    let file = fs.readFileSync(config, 'utf8');

    /* Parse config file. */
    let targets = JSON.parse(file);

    /* Scan assets for potential profit. */
    Object.keys(targets).forEach(async function (target) {
        const min = targets[target][0];
        const max = targets[target][1];

        console.log(`Query the price of ${target}...`)

        let price;
        try {
            price = await queryStockPrice(target);
        } catch (err) {
            await sendMail(`Unable to fetch stock data ${target}`, 'Please check your app');
            return;
        }

        if (price <= min) {
            await sendMail(`Buy ${target} at ${price}`, `Buy ${target} at ${price}`);
        } else if (max <= price) {
            await sendMail(`Sell ${target} at ${price}`, `Sell ${target} at ${price}`);
        }
    });
})();
