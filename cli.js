#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let base_path = path.dirname(fs.realpathSync(__filename));
let app_path = path.join(base_path, 'dist', 'app.js');

require(app_path);