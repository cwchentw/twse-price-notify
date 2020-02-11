/* Read .env config file. */
require('dotenv').config();

const fs = require('fs');
const puppeteer = require('puppeteer');
const superagent = require('superagent');

const PROGRAM = "twse-price-notify";
const LICENSE = "MIT";
const VERSION = "0.1.0";

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
        await browser.close();
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

const delay = function (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
};

/* Main function. */
(async function () {
    /* Get config path. */
    let args = process.argv;

    if (args.length < 3) {
        console.error('No valid config');
        console.error(`Usage: ${PROGRAM} assets.json`);
        process.exit(1);
    }

    if ('-h' === args[2] || '--help' === args[2]) {
        console.log(`Usage: ${PROGRAM} assets.json`);
        process.exit(0);
    }
    else if ('-v' === args[2] || '--version' === args[2]) {
        console.log(`${VERSION}`);
        process.exit(0);
    }
    else if ('--license' === args[2]) {
        console.log(`${LICENSE}`);
        process.exit(0);
    }
    else if (args[2].startsWith('-')) {
        console.error(`Invalid argument: ${args[2]}`);
        process.exit(1);
    }

    const config = args[2];

    /* Read config file. */
    let file;
    try {
        file = fs.readFileSync(config, 'utf8');
    } catch (err) {
        console.error(`Invalid file: ${err}`);
        process.exit(1);
    }

    /* Parse config file. */
    let targets;
    try {
        targets = JSON.parse(file);
    } catch (err) {
        console.log(`Invalid config: ${err}`);
        process.exit(1);
    }

    /* Scan assets for potential profit. */
    for (let target in targets) {
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

        await delay(5000);
    }
})();
